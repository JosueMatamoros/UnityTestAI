import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { collectClassAndMethod } from '../collectInputs';
import { buildPrompt } from '../prompts/promptBuilder';
import { generateWithGemini, generateWithOpenRouter } from '../llm';
import { checkSymbols } from '../utils/codeValidation';
import { loadOpenRouterModels } from '../utils/modelLoader';

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

      case 'generateTest': {
        const { className, methodName } = await collectClassAndMethod(panel);
        const prompt = buildPrompt(methodName, className, code);

        let result = "Modelo no válido";
        if (message.model === "gemini") {
          result = await generateWithGemini(prompt);
        } else if (message.model === "openrouter") {
          if (!message.subModel) {
            vscode.window.showErrorMessage("Debes seleccionar un submodelo de OpenRouter.");
            return;
          }
          result = await generateWithOpenRouter(prompt, message.subModel);
        }

        panel.webview.postMessage({ command: 'showResult', result });
        break;
      }
    }
  });
}
