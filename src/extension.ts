// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('UnityTestIA extension is now active!');

	const showCodeCommand = vscode.commands.registerCommand('UnityTestIA.generateTest', async () => { 
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No hay ningún editor activo')
			return;
		}

		const document = editor.document;
		const text = document.getText();

		const panel = vscode.window.createWebviewPanel(
			'unityTestIAView', 
			'UnityTestIA - vista C#',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true
			}
		);

		panel.webview.html = getWebviewContent(text)
	});

	context.subscriptions.push(showCodeCommand);
}

function getWebviewContent(code: string): string {
	const safeCode = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
	return ` 
	<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">

		<!-- Estilos de Highlight.js (tema oscuro) -->
        <link rel="stylesheet"
              href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css">
		<style>
            body {
                font-family: monospace;
                background-color: #1e1e1e;
                color: #dcdcdc;
                padding: 16px;
            }
            pre {
                padding: 12px;
                border-radius: 8px;
                overflow-x: auto;
            }
        </style>
		 </head>
    <body>
        <h2>Clase detectada en C#</h2>
        <pre><code class="language-cs">${safeCode}</code></pre>
		 <!-- Script de Highlight.js -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
        <script>hljs.highlightAll();</script>
    </body>
    </html>`;
}

// This method is called when your extension is deactivated
export function deactivate() {}
