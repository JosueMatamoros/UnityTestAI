// src/extension.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { collectClassAndMethod } from '../collectInputs';
import { buildPrompt } from '../prompts/promptBuilder';
import { ChatSession } from '../llm/sessionManager';
import { generateWithOpenRouter, generateWithChatGPT, generateWithDeepSeek, generateWithGeminiChat } from '../llm';
import { checkSymbols } from '../utils/codeValidation';
import { loadOpenRouterModels } from '../utils/modelLoader';
import { saveUnityTest } from '../utils/testSaver';
import { getFilteredAssetsTree } from '../utils/getFilteredAssetsTree';
import { handleDependencyResponse } from "../utils/dependencyPromptHandler";

// === Sesiones por panel ===
const sessionsByPanel = new WeakMap<vscode.WebviewPanel, ChatSession>();

// === Manejadores por modelo ===
const modelHandlers: Record<string, (prompt: string, panel: vscode.WebviewPanel, subModel?: string) => Promise<string>> = {
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
  chatgpt: (prompt, _panel, subModel) => generateWithChatGPT(prompt, subModel || "gpt-4o-mini"),
  deepseek: (prompt) => generateWithDeepSeek(prompt),
  openrouter: (prompt, _panel, subModel) => {
    if (!subModel) throw new Error("Debes indicar un submodelo de OpenRouter.");
    return generateWithOpenRouter(prompt, subModel);
  },
};

// === Guardar resultado si es válido ===
function saveResult(result: string, className: string, methodName: string, model: string) {
  if (result && !result.startsWith("Modelo no válido") && !result.toLowerCase().includes("error")) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      saveUnityTest(workspaceRoot, result, className, methodName, model);
    }
  }
}

// === Manejar dependencias ===
async function handleDependencies(
  model: string,
  panel: vscode.WebviewPanel,
  subModel: string | null,
  result: string,
  className: string,
  methodName: string
) {
  const dependencyPrompt = handleDependencyResponse(result);
  if (!dependencyPrompt) {
    saveResult(result, className, methodName, model);
    return;
  }

  const handler = modelHandlers[model];
  if (!handler) throw new Error(`Modelo no válido: ${model}`);

  const dependencyResult = await handler(dependencyPrompt, panel, subModel ?? undefined);
  panel.webview.postMessage({ command: "showDependencyResult", result: dependencyResult });
  saveResult(dependencyResult, className, methodName, model);
}

// === Generar código optimizado ===
async function handleGenerate(
  className: string,
  methodName: string,
  model: string,
  subModel: string | null,
  code: string,
  panel: vscode.WebviewPanel
) {
  try {
    const projectTree = getFilteredAssetsTree();
    console.log("\n📁 Estructura detectada:\n" + projectTree + "\n");

    const prompt = buildPrompt(methodName, className, code, projectTree);
    const handler = modelHandlers[model];
    if (!handler) throw new Error(`Modelo no válido: ${model}`);

    // 👇 Aquí también
    const result = await handler(prompt, panel, subModel ?? undefined);
    panel.webview.postMessage({ command: "showResult", result });
    await handleDependencies(model, panel, subModel, result, className, methodName);

  } catch (err: any) {
    vscode.window.showErrorMessage("Error al generar: " + err.message);
  }
}

// === Crear panel Webview ===
export async function createWebviewPanel(context: vscode.ExtensionContext, code: string) {
  const panel = vscode.window.createWebviewPanel(
    'unityTestIAView',
    'Unity Test IA',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'ui')),
        vscode.Uri.file(path.join(context.extensionPath, 'assets')),
        vscode.Uri.file(path.join(context.extensionPath, 'dist')),
      ],
    }
  );

  // Modelos disponibles
  const models: { id: string; name: string; type?: string }[] = [];
  if (process.env.GEMINI_API_KEY) models.push({ id: "gemini", name: "Google Gemini", type: "direct" });
  if (process.env.OPENAI_API_KEY) models.push({ id: "chatgpt", name: "ChatGPT", type: "direct" });
  if (process.env.DEEPSEEK_API_KEY) models.push({ id: "deepseek", name: "DeepSeek", type: "direct" });

  let openRouterModels: any[] = [];
  if (process.env.OPENROUTER_API_KEY) {
    openRouterModels = loadOpenRouterModels(context.extensionPath);
    models.push({ id: "openrouter", name: "OpenRouter", type: "group" });
  }

  // Paths estáticos
  const uiPath = path.join(context.extensionPath, 'ui', 'index.html');
  const cssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'dist', 'bundle.css')));
  const logoUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'assets', 'logo.png')));
  const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'dist', 'bundle.js')));

  // Inyectar HTML
  let html = fs.readFileSync(uiPath, 'utf8');
  html = html.replace('${code}', code.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  html = html.replace('${logoUri}', logoUri.toString());
  html = html.replace('@@styleUri', cssUri.toString());
  html = html.replace('@@scriptUri', scriptUri.toString());
  panel.webview.html = html;

  // Inicializar UI
  panel.webview.postMessage({ command: "setModels", models });
  const session = new ChatSession();
  sessionsByPanel.set(panel, session);

  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case 'validateInputs': {
        const { className, methodName } = await collectClassAndMethod(panel);
        const { classOk, methodOk } = checkSymbols(code, className, methodName);

        if (!classOk || !methodOk) {
          let msg = '';
          if (!classOk && !methodOk) {
            msg = `La clase "${className}" y el método "${methodName}" no existen en el documento.`;
          } else if (!classOk) {
            msg = `La clase "${className}" no existe en el documento.`;
          } else {
            msg = `El método "${methodName}" no existe en la clase.`;
          }
          vscode.window.showErrorMessage(msg);
          panel.webview.postMessage({ command: 'resetInputs' });
          return;
        }
        panel.webview.postMessage({ command: 'goToStep2', className, methodName });
        break;
      }

      case 'webviewReady': {
        panel.webview.postMessage({ command: "setModels", models });
        if (openRouterModels.length) {
          panel.webview.postMessage({ command: "setSubModels", subModels: openRouterModels });
        }
        break;
      }

      case "generateFromConfig": {
        const { className, methodName, model, subModel } = message;
        await handleGenerate(className, methodName, model, subModel, code, panel);
        break;
      }

      case 'generateTest': {
        const { className, methodName } = await collectClassAndMethod(panel);
        await handleGenerate(className, methodName, message.model, message.subModel, code, panel);
        break;
      }

      case 'chatMessage': {
        const session = sessionsByPanel.get(panel);
        if (!session) {
          vscode.window.showErrorMessage("No hay sesión de chat activa.");
          return;
        }

        const text = String(message.text || "").trim();
        if (!text) return;

        session.addUserMessage(text);
        const reply = await generateWithGeminiChat(session.getMessages());
        session.addAssistantMessage(reply);
        panel.webview.postMessage({ command: 'chatResponse', text: reply });
        break;
      }
    }
  });
}
