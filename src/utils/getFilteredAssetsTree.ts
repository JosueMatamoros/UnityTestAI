import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/**
 * Genera un árbol de archivos dentro del workspace.
 * Si el workspace ya está en la carpeta Assets, no busca otra.
 */
export function getFilteredAssetsTree(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    console.error("No hay workspace abierto.");
    return "";
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // Detecta si ya estamos en Assets o si hay que entrar a ella
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
