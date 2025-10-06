import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { collectClassAndMethod } from '../collectInputs';
import { buildPrompt } from '../prompts/promptBuilder';
import { ChatSession } from '../llm/sessionManager';
import { generateWithGemini, generateWithOpenRouter, generateWithChatGPT, generateWithDeepSeek, generateWithGeminiChat } from '../llm';
import { checkSymbols } from '../utils/codeValidation';
import { loadOpenRouterModels } from '../utils/modelLoader';
import { saveUnityTest } from '../utils/testSaver';

async function handleGenerate(
  className: string,
  methodName: string,
  model: string,
  subModel: string | null,
  code: string,
  panel: vscode.WebviewPanel
) {
  const prompt = buildPrompt(methodName, className, code);
  let result = "Modelo no válido";

  try {
    if (model === "gemini") {
      // Recuperar la sesión asociada a este panel
      let session = sessionsByPanel.get(panel);

      // Si por alguna razón no existe, crear una nueva
      if (!session) {
        session = new ChatSession();
        sessionsByPanel.set(panel, session);
      }

      // Este prompt (de buildPrompt) es el primer mensaje del chat
      session.reset(); // limpiamos cualquier conversación anterior
      session.addUserMessage(prompt);

      // Enviar la conversación actual (solo el prompt) al modelo Gemini
      result = await generateWithGeminiChat(session.getMessages());

      // Guardar la respuesta del modelo en la sesión
      session.addAssistantMessage(result);

      // Actualizar la sesión en el WeakMap
      sessionsByPanel.set(panel, session);
    }
    else if (model === "chatgpt") {
      result = await generateWithChatGPT(prompt, subModel || "gpt-4o-mini");
    } else if (model === "deepseek") {
      result = await generateWithDeepSeek(prompt);
    } else if (model === "openrouter") {
      if (!subModel) {
        vscode.window.showErrorMessage("Debes indicar un submodelo de OpenRouter.");
        return;
      }
      result = await generateWithOpenRouter(prompt, subModel);
    }

    // Solo guardar si parece válido
    if (result && !result.startsWith("Modelo no válido") && !result.toLowerCase().includes("error")) {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        saveUnityTest(workspaceRoot, result, className, methodName, model);
      }
    }

    panel.webview.postMessage({ command: "showResult", result });
  } catch (err: any) {
    vscode.window.showErrorMessage("Error al generar: " + err.message);
  }
}

// Mapa global para mantener sesiones por panel (no se filtra memoria)
const sessionsByPanel = new WeakMap<vscode.WebviewPanel, ChatSession>();

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
  if (process.env.GEMINI_API_KEY) {
    models.push({ id: "gemini", name: "Google Gemini", type: "direct" });
  }
  if (process.env.OPENAI_API_KEY) {
    models.push({ id: "chatgpt", name: "ChatGPT", type: "direct" });
  }

  if (process.env.DEEPSEEK_API_KEY) {
    models.push({ id: "deepseek", name: "DeepSeek", type: "direct" });
  }

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

  // Pasar modelos iniciales
  panel.webview.postMessage({ command: "setModels", models });

  // Crear una sesión de chat específica para este panel
  const session = new ChatSession();
  sessionsByPanel.set(panel, session);
  // Eventos del webview
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

        // Agregar el mensaje del usuario al historial
        session.addUserMessage(text);

        // Generar respuesta con todo el contexto actual
        const reply = await generateWithGeminiChat(session.getMessages());

        // Guardar la respuesta en la sesión
        session.addAssistantMessage(reply);

        // Enviar la respuesta de vuelta a la UI
        panel.webview.postMessage({ command: 'chatResponse', text: reply });
        break;
      }

    }
  });
}
