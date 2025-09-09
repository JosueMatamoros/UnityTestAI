// src/collectInputs.ts
import * as vscode from 'vscode';

export type NameInputs = { className: string; methodName: string };

export async function collectClassAndMethod(panel: vscode.WebviewPanel): Promise<NameInputs> {
  panel.webview.postMessage({ command: 'requestInputs' });

  return new Promise<NameInputs>((resolve, reject) => {
    const sub = panel.webview.onDidReceiveMessage((msg) => {
      if (!msg) return;

      if (msg.command === 'inputsProvided') {
        const { className, methodName } = msg;
        sub.dispose();

        if (!className?.trim() || !methodName?.trim()) {
          return reject(new Error('El nombre de la clase y el nombre del método son obligatorios.'));
        }
        resolve({ className: String(className).trim(), methodName: String(methodName).trim() });
      }

      if (msg.command === 'inputsCancelled') {
        sub.dispose();
        reject(new Error('Entrada cancelada por el usuario.'));
      }
    });
  });
}
