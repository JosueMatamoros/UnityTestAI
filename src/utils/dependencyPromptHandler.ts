import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/**
 * Verifica si la respuesta del LLM solicita clases adicionales y construye un nuevo prompt si es necesario.
 * @param llmResponse Respuesta completa del LLM.
 * @param basePrompt Prompt original que se usó.
 * @returns string | null Nuevo prompt con dependencias si aplica, o null si no se requieren.
 */
export function handleDependencyResponse(llmResponse: string, basePrompt: string): string | null {
  const dependencyTrigger = "To generate the tests successfully, I need the following class definitions:";

  //  Limpiar backticks y espacios
  const cleanResponse = llmResponse
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```$/, "")
    .trim();

  if (!cleanResponse.startsWith(dependencyTrigger)) {
    return null;
  }

  //  Extraer rutas Assets/...
  const filePaths = Array.from(cleanResponse.matchAll(/Assets\/[^\s]+/g)).map(match => match[0]);
  if (filePaths.length === 0) {
    console.warn("⚠️ No se encontraron rutas de dependencias en la respuesta.");
    return null;
  }

  //  Leer archivos
  const dependenciesContent = getClassContents(filePaths);

  const newPrompt = `${basePrompt}\n\n---\n### Additional Class Definitions\n${dependenciesContent}\n\nEstas son las clases necesarias para realizar la prueba solicitada en la solicitud anterior. Procede a generar las pruebas ahora.`;

  return newPrompt;
}

function getClassContents(filePaths: string[]): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return "";

  const rootPath = workspaceFolders[0].uri.fsPath;
  let combinedContent = "";

  for (const file of filePaths) {
    // Eliminar "Assets/" duplicado si existe
    const relativePath = file.replace(/^Assets[\\/]/, "");
    const absolutePath = path.join(rootPath, relativePath);

    if (fs.existsSync(absolutePath)) {
      const content = fs.readFileSync(absolutePath, "utf8");
      combinedContent += `\n\n// File: ${file}\n${content}`;
    } else {
      console.warn(`No se encontró el archivo: ${absolutePath}`);
    }
  }

  return combinedContent;
}

