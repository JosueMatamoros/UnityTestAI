import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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

        // Cargar HTML
        let html = fs.readFileSync(uiPath, 'utf8');
        html = html.replace('${code}', text.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
        html = html.replace('${logoUri}', logoUri.toString());
        html = html.replace('@@styleUri', cssUri.toString());

        panel.webview.html = html;
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
