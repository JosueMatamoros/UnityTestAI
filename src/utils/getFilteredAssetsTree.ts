import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/**
 * Genera un árbol completo de TODAS las carpetas y archivos .cs dentro de Assets
 */
export function getFilteredAssetsTree(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    console.error("No hay workspace abierto.");
    return "";
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // Detectar si estamos ya en Assets
  const assetsDir =
    path.basename(workspaceRoot).toLowerCase() === "assets"
      ? workspaceRoot
      : path.join(workspaceRoot, "Assets");

  if (!fs.existsSync(assetsDir)) {
    console.error("No se encontró la carpeta 'Assets' en:", assetsDir);
    return "";
  }

  let tree = "Assets\n";
  tree += getRecursiveTree(assetsDir, 1);

  console.log("\n====== UNITY ASSETS TREE ======\n");
  console.log(tree);
  console.log("\n===============================\n");

  return tree.trim();
}

/**
 * Recorre recursivamente TODAS las carpetas y archivos .cs dentro de un directorio dado.
 */
function getRecursiveTree(dirPath: string, depth: number): string {
  let output = "";

  const indent = "  ".repeat(depth);
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);

    if (item.isDirectory()) {
      output += `${indent}- ${item.name}\n`;
      output += getRecursiveTree(fullPath, depth + 1);
    } else if (item.name.endsWith(".cs")) {
      output += `${indent}- ${item.name}\n`;
    }
  }

  return output;
}
