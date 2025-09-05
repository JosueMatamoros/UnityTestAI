import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { buildPrompt } from './promptBuilder';
import { generateWithDeepSeek, generateWithGemini } from './llm';

dotenv.config({ path: path.join(__dirname, "..", ".env") });

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

        const models: {id: string; name: string} [] = []

        if (process.env.GEMINI_API_KEY){
            models.push({id: 'gemini', name: 'Google Gemini'});
        }
        if (process.env.DEEPSEEK_API_KEY) {
            models.push({ id: 'deepseek', name: 'DeepSeek' });
        }

        panel.webview.postMessage({ command: "setModels", models });

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

        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'generateTest') {
                const methodName = "CheckHorizontal1(int row, int column, ShapesArray shapes)";
                const className = "Utilities";
                const prompt = buildPrompt(methodName, className, text);
                let result = "Modelo no valido";
                if (message.model ==  "gemini") {
                    result = await generateWithGemini(prompt);
                } else if (message.model == "deepseek") {
                    result = await generateWithDeepSeek(prompt);
                }

                panel.webview.postMessage({ command: 'showResult', result });
            }
        });

    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
