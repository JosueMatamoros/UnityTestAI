import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/**
 * Genera una representación en texto del árbol de directorios dentro de la carpeta `Assets` de un proyecto Unity.
 *
 * @returns {string} Árbol de archivos en formato legible con indentación por niveles.
 */
export function getFilteredAssetsTree(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    console.error("No hay workspace abierto.");
    return "";
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // Detectar si ya estamos dentro de Assets o si hay que entrar a ella
  const assetsDir =
    path.basename(workspaceRoot).toLowerCase() === "assets"
      ? workspaceRoot
      : path.join(workspaceRoot, "Assets");

  if (!fs.existsSync(assetsDir)) {
    console.error(" No se encontró la carpeta 'Assets' en:", assetsDir);
    return "";
  }

  let tree = "Assets\n";
  const entries = fs.readdirSync(assetsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;

    if (name !== "Scripts") {
      tree += `  - ${name}\n`;
    } else {
      const scriptsPath = path.join(assetsDir, name);
      tree += `  - ${name}\n`;
      tree += getScriptsRecursive(scriptsPath, 2);
    }
  }

  return tree.trim();
}

/**
 * Recorre recursivamente la carpeta `Scripts` y devuelve su estructura jerárquica
 * incluyendo subdirectorios y archivos `.cs`.
 *
 * @param {string} dirPath - Ruta absoluta de la carpeta actual que se está recorriendo.
 * @param {number} depth - Nivel de indentación para formatear la salida.
 * @returns {string} Texto con la estructura jerárquica de la carpeta.
 */
function getScriptsRecursive(dirPath: string, depth: number): string {
  let output = "";
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    if (item.isDirectory()) {
      output += `${" ".repeat(depth * 2)}- ${item.name}\n`;
      output += getScriptsRecursive(path.join(dirPath, item.name), depth + 1);
    } else if (item.name.endsWith(".cs")) {
      output += `${" ".repeat(depth * 2)}- ${item.name}\n`;
    }
  }

  return output;
}
