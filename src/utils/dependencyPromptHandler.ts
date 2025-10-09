import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/**
 * Analiza la respuesta de un modelo LLM para detectar solicitudes de clases adicionales
 * necesarias para completar la generación de pruebas.  
 * Si se encuentran dependencias, construye SOLO el bloque adicional con las definiciones
 * de clases, sin volver a incluir el prompt original.
 *
 * @param {string} llmResponse - Respuesta completa recibida del modelo LLM.
 * @returns {string|null} Texto adicional con definiciones de clases si se requieren dependencias, o `null` si no aplica.
 */
export function handleDependencyResponse(llmResponse: string): string | null {
  const dependencyTrigger = "To generate the tests successfully, I need the following class definitions:";

  // Limpiar delimitadores Markdown y espacios innecesarios
  const cleanResponse = llmResponse
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```$/, "")
    .trim();

  // Salir si la respuesta no contiene el trigger 
  if (!cleanResponse.startsWith(dependencyTrigger)) {
    return null;
  }

  // Extraer rutas que comiencen con Assets/...
  const filePaths = Array.from(cleanResponse.matchAll(/Assets\/[^\s]+/g)).map(match => match[0]);
  if (filePaths.length === 0) {
    console.warn("No se encontraron rutas de dependencias en la respuesta.");
    return null;
  }

  // Leer y concatenar contenido de las clases referenciadas
  const dependenciesContent = getClassContents(filePaths);

  // Nuevo prompt 
  const dependencyBlock = `### Additional Class Definitions\n${dependenciesContent}\n\nThese are the required class definitions needed to complete the requested test generation. Please continue generating the tests using this additional context.`;
  return dependencyBlock;
}

/**
 * Lee el contenido de las clases especificadas en las rutas dadas y concatena sus textos,
 * incluyendo comentarios de referencia de archivo.  
 * Solo busca dentro de la carpeta raíz del workspace actual en VS Code.
 *
 * @param {string[]} filePaths - Lista de rutas relativas a partir de `Assets/`.
 * @returns {string} Contenido concatenado de las clases encontradas.
 */
function getClassContents(filePaths: string[]): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return "";

  const rootPath = workspaceFolders[0].uri.fsPath;
  let combinedContent = "";

  for (const file of filePaths) {
    const relativePath = file.replace(/^Assets[\\/]/, "");
    const absolutePath = path.join(rootPath, relativePath);

    if (fs.existsSync(absolutePath)) {
      const content = fs.readFileSync(absolutePath, "utf8");
      combinedContent += `\n\n// File: ${file}\n${content}`;
    } else {
      console.warn(` No se encontró el archivo: ${absolutePath}`);
    }
  }

  return combinedContent;
}
