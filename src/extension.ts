import * as vscode from 'vscode';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createWebviewPanel } from './webview/webviewManager';

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

    await createWebviewPanel(context, text);
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
