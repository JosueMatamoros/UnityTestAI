import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { collectClassAndMethod } from "../collectInputs";
import { ChatSession } from "../llm/sessionManager";
import { generateWithChatGPT, generateWithOllama } from "../llm";
import { checkSymbols } from "../utils/codeValidation";
import { saveUnityTest } from "../utils/testSaver";
import { getFilteredAssetsTree } from "../utils/getFilteredAssetsTree";
import { runDependencyResolver } from "../agents/dependencyResolver";
import { saveAgentOutput } from "../agents/agentOutputSaver";

const sessionsByPanel = new WeakMap<vscode.WebviewPanel, ChatSession>();

const generationMetaByPanel = new WeakMap<
  vscode.WebviewPanel,
  { className: string; methodName: string; model: string; subModel: string | null }
>();

const modelHandlers: Record<
  string,
  (prompt: string, panel: vscode.WebviewPanel, subModel?: string) => Promise<string>
> = {
  chatgpt: async (prompt, panel, subModel) => {
    let session = sessionsByPanel.get(panel);
    if (!session) { session = new ChatSession(); sessionsByPanel.set(panel, session); }
    session.addUserMessage(prompt);
    const result = await generateWithChatGPT(session.getMessages(), subModel || "gpt-4o-mini");
    session.addAssistantMessage(result);
    return result;
  },
  llamaLocal: async (prompt, panel) => {
    let session = sessionsByPanel.get(panel);
    if (!session) { session = new ChatSession(); sessionsByPanel.set(panel, session); }
    session.addUserMessage(prompt);
    const result = await generateWithOllama(session.getMessages());
    session.addAssistantMessage(result);
    return result;
  },
};

function saveResult(result: string, className: string, methodName: string, model: string) {
  if (result && !result.startsWith("Modelo no válido") && !result.toLowerCase().includes("error")) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders?.length) {
      saveUnityTest(workspaceFolders[0].uri.fsPath, result, className, methodName, model);
    }
  }
}

function notifyAgent(
  panel: vscode.WebviewPanel,
  agent: string,
  status: "running" | "done" | "error",
  detail?: string
) {
  panel.webview.postMessage({ command: "agentStatus", agent, status, detail });
}

async function handleGenerate(
  className: string,
  methodName: string,
  model: string,
  subModel: string | null,
  code: string,
  panel: vscode.WebviewPanel,
  _context: vscode.ExtensionContext
) {
  generationMetaByPanel.set(panel, { className, methodName, model, subModel });

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    vscode.window.showErrorMessage("No hay un workspace abierto.");
    return;
  }
  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  try {
    const projectTree = getFilteredAssetsTree();
    panel.webview.postMessage({ command: "clearPipeline" });

    const handler = modelHandlers[model];
    if (!handler) throw new Error(`Modelo no válido: ${model}`);

    // ── Step 1: Dependency Resolver ──────────────────────────────────────────
    const currentAgent = "Dependency Resolver";
    notifyAgent(panel, currentAgent, "running");
    const depResult = await runDependencyResolver(
      { code, projectTree, className, methodName, workspaceRoot },
      (prompt) => handler(prompt, panel, subModel ?? undefined)
    );
    const savedPath = saveAgentOutput("dependency-resolver", depResult);
    notifyAgent(panel, currentAgent, "done", savedPath ?? undefined);

    // ── TODO: remaining agents will be added here ────────────────────────────

  } catch (err: any) {
    panel.webview.postMessage({ command: "agentError", message: err.message });
    vscode.window.showErrorMessage("Error al generar: " + err.message);
  }
}

export async function createWebviewPanel(context: vscode.ExtensionContext, code: string) {
  const panel = vscode.window.createWebviewPanel(
    "unityTestIAView",
    "Unity Test IA",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, "ui")),
        vscode.Uri.file(path.join(context.extensionPath, "assets")),
        vscode.Uri.file(path.join(context.extensionPath, "dist")),
      ],
    }
  );

  const models: { id: string; name: string; type?: string }[] = [];
  if (process.env.OPENAI_API_KEY)
    models.push({ id: "chatgpt", name: "ChatGPT", type: "direct" });
  models.push({ id: "llamaLocal", name: "Llama Local", type: "direct" });

  const uiPath = path.join(context.extensionPath, "ui", "index.html");
  const cssUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, "dist", "bundle.css"))
  );
  const logoUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, "assets", "logo.png"))
  );
  const scriptUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, "dist", "bundle.js"))
  );

  let html = fs.readFileSync(uiPath, "utf8");
  html = html.replace("${code}", code.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  html = html.replace("${logoUri}", logoUri.toString());
  html = html.replace("@@styleUri", cssUri.toString());
  html = html.replace("@@scriptUri", scriptUri.toString());
  panel.webview.html = html;

  panel.webview.postMessage({ command: "setModels", models });
  sessionsByPanel.set(panel, new ChatSession());

  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case "validateInputs": {
        const { className, methodName } = await collectClassAndMethod(panel);
        const { classOk, methodOk } = checkSymbols(code, className, methodName);
        if (!classOk || !methodOk) {
          const msg = !classOk && !methodOk
            ? `La clase "${className}" y el método "${methodName}" no existen en el documento.`
            : !classOk
            ? `La clase "${className}" no existe en el documento.`
            : `El método "${methodName}" no existe en la clase.`;
          vscode.window.showErrorMessage(msg);
          panel.webview.postMessage({ command: "resetInputs" });
          return;
        }
        panel.webview.postMessage({ command: "goToStep2", className, methodName });
        break;
      }

      case "webviewReady": {
        panel.webview.postMessage({ command: "setModels", models });
        break;
      }

      case "generateFromConfig": {
        const { className, methodName, model, subModel } = message;
        const { classOk, methodOk } = checkSymbols(code, className, methodName);
        if (!classOk || !methodOk) {
          const what = !classOk
            ? `Class "${className}" not found`
            : `Method "${methodName}" not found in "${className}"`;
          vscode.window.showErrorMessage(`generateFromConfig: ${what} in the active file.`);
          panel.webview.postMessage({ command: "generationError", message: what });
          return;
        }
        await handleGenerate(className, methodName, model, subModel, code, panel, context);
        break;
      }

      case "generateTest": {
        const { className, methodName } = await collectClassAndMethod(panel);
        await handleGenerate(className, methodName, message.model, message.subModel, code, panel, context);
        break;
      }

      case "chatMessage": {
        const session = sessionsByPanel.get(panel);
        if (!session) { vscode.window.showErrorMessage("No hay sesión de chat activa."); return; }

        const text = String(message.text || "").trim();
        if (!text) return;

        session.addUserMessage(text);

        const meta = generationMetaByPanel.get(panel);
        if (!meta) { vscode.window.showErrorMessage("No hay configuración de modelo cargada."); return; }

        const handler = modelHandlers[meta.model];
        const reply = await handler(text, panel, meta.subModel ?? undefined);
        session.addAssistantMessage(reply);
        saveResult(reply, meta.className, meta.methodName, meta.model);
        panel.webview.postMessage({ command: "chatResponse", text: reply });
        break;
      }
    }
  });
}
