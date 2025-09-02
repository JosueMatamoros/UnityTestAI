import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { buildPrompt } from './promptBuilder';
import { generateWithGemini } from './llm';

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
                const methodName = "Line(Int2 s, Int2 e, PlotFunction plot)";
                const className = "Bresenhams";
                const prompt = buildPrompt(methodName, className, text);
                const result = await generateWithGemini(prompt);
                panel.webview.postMessage({ command: 'showResult', result });
            }
        });

    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
