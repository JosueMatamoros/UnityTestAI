// src/collectInputs.ts
import * as vscode from 'vscode';

export type NameInputs = { className: string; methodName: string };

/**
 * Solicita al usuario el nombre de una clase y un método a través de la webview asociada a un panel.
 * Envía un mensaje a la webview para pedir los datos y espera la respuesta del usuario.
 *
 * @async
 * @function collectClassAndMethod
 * @param {vscode.WebviewPanel} panel - Panel de la extensión que contiene la webview desde donde se obtendrán los datos.
 * @returns {Promise<NameInputs>} Promesa que se resuelve con un objeto que incluye `className` y `methodName`.
 * @throws {Error} Lanza un error si el usuario cancela la entrada o si los valores proporcionados están vacíos.
 *
 * @fires requestInputs - Se envía a la webview para solicitar los valores de clase y método.
 * @listens inputsProvided - Evento recibido cuando el usuario proporciona los valores.
 * @listens inputsCancelled - Evento recibido cuando el usuario cancela la entrada.
 */
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
