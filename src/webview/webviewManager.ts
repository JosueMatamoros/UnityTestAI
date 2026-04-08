// src/extension.ts
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { collectClassAndMethod } from "../collectInputs";
// buildPrompt is used inside each agent module, not here directly
import { ChatSession } from "../llm/sessionManager";
import {
  generateWithOpenRouterChat,
  generateWithChatGPT,
  generateWithDeepSeek,
  generateWithGeminiChat,
  generateWithLocalLlamaChat,
} from "../llm";
import { checkSymbols } from "../utils/codeValidation";
import { loadOpenRouterModels } from "../utils/modelLoader";
import { saveUnityTest } from "../utils/testSaver";
import { getFilteredAssetsTree } from "../utils/getFilteredAssetsTree";
import { runDependencyResolver } from "../agents/dependencyResolver";
import { saveAgentOutput } from "../agents/agentOutputSaver";

/**
 * Mapa global que asocia un panel de Webview con su sesión de chat correspondiente.
 * Permite mantener conversaciones independientes por panel abierto.
 * @type {WeakMap<vscode.WebviewPanel, ChatSession>}
 */
const sessionsByPanel = new WeakMap<vscode.WebviewPanel, ChatSession>();

/**
 * Guarda los metadatos de la generación (className y methodName) por panel.
 * Así las peticiones posteriores al LLM pueden usar esta info.
 */
const generationMetaByPanel = new WeakMap<
  vscode.WebviewPanel,
  {
    className: string;
    methodName: string;
    model: string;
    subModel: string | null;
  }
>();

/**
 * Objeto que mapea los modelos disponibles a sus funciones de generación de contenido.
 * Cada modelo define cómo construir la respuesta a partir de un prompt.
 * @type {Record<string, (prompt: string, panel: vscode.WebviewPanel, subModel?: string) => Promise<string>>}
 */
const modelHandlers: Record<
  string,
  (
    prompt: string,
    panel: vscode.WebviewPanel,
    subModel?: string
  ) => Promise<string>
> = {
  gemini: async (prompt, panel) => {
    let session = sessionsByPanel.get(panel);
    if (!session) {
      session = new ChatSession();
      sessionsByPanel.set(panel, session);
    }
    session.addUserMessage(prompt);
    const result = await generateWithGeminiChat(session.getMessages());
    session.addAssistantMessage(result);
    return result;
  },
  chatgpt: (prompt, _panel, subModel) =>
    generateWithChatGPT(prompt, subModel || "gpt-4o-mini"),
  deepseek: (prompt) => generateWithDeepSeek(prompt),
  llamaLocal: async (prompt, panel) => {
    let session = sessionsByPanel.get(panel);
    if (!session) {
      session = new ChatSession();
      sessionsByPanel.set(panel, session);
    }
    session.addUserMessage(prompt);
    const result = await generateWithLocalLlamaChat(session.getMessages());
    session.addAssistantMessage(result);
    return result;
  },
  openrouter: async (prompt, panel, subModel) => {
    if (!subModel) throw new Error("Debes indicar un submodelo de OpenRouter.");

    let session = sessionsByPanel.get(panel);
    if (!session) {
      session = new ChatSession();
      sessionsByPanel.set(panel, session);
    }

    session.addUserMessage(prompt);
    const result = await generateWithOpenRouterChat(
      session.getMessages(),
      subModel
    );
    session.addAssistantMessage(result);
    return result;
  },
};

/**
 * Guarda el resultado generado en un archivo de test si es válido.
 * @param {string} result - Código generado por el modelo.
 * @param {string} className - Nombre de la clase objetivo.
 * @param {string} methodName - Nombre del método objetivo.
 * @param {string} model - Modelo utilizado para la generación.
 */
function saveResult(
  result: string,
  className: string,
  methodName: string,
  model: string
) {
  if (
    result &&
    !result.startsWith("Modelo no válido") &&
    !result.toLowerCase().includes("error")
  ) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      saveUnityTest(workspaceRoot, result, className, methodName, model);
    }
  }
}



/**
 * Ejecuta la generación de código de prueba a partir de la clase, método y modelo seleccionados.
 * También maneja las dependencias que puedan surgir de la respuesta del modelo.
 * @async
 * @param {string} className - Nombre de la clase objetivo.
 * @param {string} methodName - Nombre del método objetivo.
 * @param {string} model - Modelo utilizado.
 * @param {string|null} subModel - Submodelo (opcional).
 * @param {string} code - Código original.
 * @param {vscode.WebviewPanel} panel - Panel asociado.
 * @throws {Error} Si no se encuentra el modelo especificado.
 */
/** Sends an agent status update to the webview UI. */
function notifyAgent(
  panel: vscode.WebviewPanel,
  agent: string,
  status: "running" | "done" | "error",
  model?: string,
  detail?: string
) {
  panel.webview.postMessage({ command: "agentStatus", agent, status, model, detail });
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

    // Clear previous pipeline
    panel.webview.postMessage({ command: "clearPipeline" });

    // Resolve the LLM handler for the selected model
    const handler = modelHandlers[model];
    if (!handler) throw new Error(`Modelo no válido: ${model}`);

    // ── Step 1: Dependency Resolver ──────────────────────────────────────────
    let currentAgent = "Dependency Resolver";
    notifyAgent(panel, currentAgent, "running");
    const depResult = await runDependencyResolver(
      { code, projectTree, className, methodName, workspaceRoot },
      (prompt) => handler(prompt, panel, subModel ?? undefined)
    );
    const savedPath = saveAgentOutput("dependency-resolver", depResult);
    notifyAgent(panel, currentAgent, "done", undefined, savedPath ?? undefined);

    // ── TODO: remaining agents will be added here ────────────────────────────

  } catch (err: any) {
    // Mark the last running agent as failed in the UI
    panel.webview.postMessage({ command: "agentError", message: err.message });
    vscode.window.showErrorMessage("Error al generar: " + err.message);
  }
}

/**
 * Crea e inicializa un panel de Webview en VS Code para la generación de tests unitarios asistidos por IA.
 * Carga los modelos disponibles, el HTML de la interfaz y maneja los eventos de interacción desde el frontend.
 * @async
 * @param {vscode.ExtensionContext} context - Contexto de la extensión de VS Code.
 * @param {string} code - Código fuente original.
 */
export async function createWebviewPanel(
  context: vscode.ExtensionContext,
  code: string
) {
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

  // Modelos disponibles
  const models: { id: string; name: string; type?: string }[] = [];
  if (process.env.GEMINI_API_KEY)
    models.push({ id: "gemini", name: "Google Gemini", type: "direct" });
  if (process.env.OPENAI_API_KEY)
    models.push({ id: "chatgpt", name: "ChatGPT", type: "direct" });
  if (process.env.DEEPSEEK_API_KEY)
    models.push({ id: "deepseek", name: "DeepSeek", type: "direct" });

  models.push({ id: "llamaLocal", name: "Llama Local", type: "direct" });

  let openRouterModels: any[] = [];
  if (process.env.OPENROUTER_API_KEY) {
    openRouterModels = loadOpenRouterModels(context.extensionPath);
    models.push({ id: "openrouter", name: "OpenRouter", type: "group" });
  }

  // Paths estáticos
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

  // Inyectar HTML
  let html = fs.readFileSync(uiPath, "utf8");
  html = html.replace(
    "${code}",
    code.replace(/</g, "&lt;").replace(/>/g, "&gt;")
  );
  html = html.replace("${logoUri}", logoUri.toString());
  html = html.replace("@@styleUri", cssUri.toString());
  html = html.replace("@@scriptUri", scriptUri.toString());
  panel.webview.html = html;

  // Inicializar UI
  panel.webview.postMessage({ command: "setModels", models });
  const session = new ChatSession();
  sessionsByPanel.set(panel, session);

  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case "validateInputs": {
        const { className, methodName } = await collectClassAndMethod(panel);
        const { classOk, methodOk } = checkSymbols(code, className, methodName);

        if (!classOk || !methodOk) {
          let msg = "";
          if (!classOk && !methodOk) {
            msg = `La clase "${className}" y el método "${methodName}" no existen en el documento.`;
          } else if (!classOk) {
            msg = `La clase "${className}" no existe en el documento.`;
          } else {
            msg = `El método "${methodName}" no existe en la clase.`;
          }
          vscode.window.showErrorMessage(msg);
          panel.webview.postMessage({ command: "resetInputs" });
          return;
        }
        panel.webview.postMessage({
          command: "goToStep2",
          className,
          methodName,
        });
        break;
      }

      case "webviewReady": {
        panel.webview.postMessage({ command: "setModels", models });
        if (openRouterModels.length) {
          panel.webview.postMessage({
            command: "setSubModels",
            subModels: openRouterModels,
          });
        }
        break;
      }

      case "generateFromConfig": {
        const { className, methodName, model, subModel } = message;

        // Validate class and method exist in the open file
        const { classOk, methodOk } = checkSymbols(code, className, methodName);
        if (!classOk || !methodOk) {
          const what = !classOk
            ? `Class "${className}" not found`
            : `Method "${methodName}" not found in "${className}"`;
          vscode.window.showErrorMessage(`generateFromConfig: ${what} in the active file.`);
          panel.webview.postMessage({ command: "generationError", message: what });
          return;
        }

        await handleGenerate(
          className,
          methodName,
          model,
          subModel,
          code,
          panel,
          context
        );
        break;
      }

      case "generateTest": {
        const { className, methodName } = await collectClassAndMethod(panel);
        await handleGenerate(
          className,
          methodName,
          message.model,
          message.subModel,
          code,
          panel,
          context
        );
        break;
      }

      case "chatMessage": {
        const session = sessionsByPanel.get(panel);
        if (!session) {
          vscode.window.showErrorMessage("No hay sesión de chat activa.");
          return;
        }

        const text = String(message.text || "").trim();
        if (!text) return;

        session.addUserMessage(text);

        const meta = generationMetaByPanel.get(panel);
        if (!meta) {
          vscode.window.showErrorMessage(
            "No hay configuración de modelo cargada."
          );
          return;
        }

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
