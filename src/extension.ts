import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { buildPrompt } from './promptBuilder';
import { generateWithGemini, generateWithOpenRouter } from './llm';
import { collectClassAndMethod } from './collectInputs';

dotenv.config({ path: path.join(__dirname, "..", ".env") });

function checkSymbols(code: string, cls: string, method: string) {
    const classRegex = new RegExp(`\\bclass\\s+${cls}\\b`, 'i');
    const methodRegex = new RegExp(`\\b${method}\\s*\\(`, 'i');
    return {
        classOk: classRegex.test(code),
        methodOk: methodRegex.test(code),
    };
}
export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('UnityTestIA.generateTest', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No hay ningún editor activo.');
            return;
        }

        const document = editor.document;
        const text = document.getText();

        // Crear panel
        const panel = vscode.window.createWebviewPanel(
            'unityTestIAView',
            'Unity Test IA',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, 'ui')),
                    vscode.Uri.file(path.join(context.extensionPath, 'assets'))
                ]
            }
        );

        const models: { id: string; name: string; type?: string; fullModel?: string }[] = [];

        if (process.env.GEMINI_API_KEY) {
            models.push({ id: "gemini", name: "Google Gemini", type: "direct" });
        }
        let openRouterModels: any[] = [];
        if (process.env.OPENROUTER_API_KEY) {
            // lee el archivo
            const jsonPath = path.join(context.extensionPath, "openrouter.models.json");
            try {
                const raw = fs.readFileSync(jsonPath, "utf8");
                openRouterModels = JSON.parse(raw);
            } catch (err) {
                console.error("No se pudo leer el archivo de modelos de OpenRouter:", err);
            }

            models.push({ id: "openrouter", name: "OpenRouter", type: "group" });

        }

        // Paths
        const uiPath = path.join(context.extensionPath, 'ui', 'index.html');
        const cssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'ui', 'style.css')));
        const logoUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'assets', 'logo.png')));
        const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'ui', 'script.js')));

        // Cargar HTML
        let html = fs.readFileSync(uiPath, 'utf8');
        html = html.replace('${code}', text.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
        html = html.replace('${logoUri}', logoUri.toString());
        html = html.replace('@@styleUri', cssUri.toString());
        html = html.replace('@@scriptUri', scriptUri.toString());
        panel.webview.html = html;

        panel.webview.postMessage({ command: "setModels", models });

        panel.webview.onDidReceiveMessage(async (message) => {

            if (message.command === 'validateInputs') {
                const { className, methodName } = await collectClassAndMethod(panel);
                const { classOk, methodOk } = checkSymbols(text, className, methodName);

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
                return;
            }

            if (message.command === 'webviewReady') {
                panel.webview.postMessage({ command: "setModels", models });
                if (openRouterModels.length) {
                    panel.webview.postMessage({ command: "setSubModels", subModels: openRouterModels });
                }
                return;
            }

            if (message.command === 'generateTest') {
                const { className, methodName } = await collectClassAndMethod(panel);
                const prompt = buildPrompt(methodName, className, text);
                let result = "Modelo no válido";

                if (message.model === "gemini") {
                    result = await generateWithGemini(prompt);
                } else if (message.model === "openrouter") {
                    const sub = message.subModel;
                    if (!sub) {
                        vscode.window.showErrorMessage("Debes seleccionar un submodelo de OpenRouter.");
                        return;
                    }
                    result = await generateWithOpenRouter(prompt, sub);
                }
                panel.webview.postMessage({ command: 'showResult', result });
            }
        });


    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
