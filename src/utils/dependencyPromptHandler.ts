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
  const dependencyTrigger =
    "To generate the tests successfully, I need the following class definitions:";

  // Limpiar delimitadores Markdown y espacios innecesarios
  const cleanResponse = llmResponse
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```$/, "")
    .trim();

  // Salir si no contiene el trigger
  if (!cleanResponse.startsWith(dependencyTrigger)) {
    return null;
  }

  const filePaths: string[] = [];

  // Extraer rutas tipo "Assets/.../Archivo.cs" o "Game/...cs"
  for (const match of cleanResponse.matchAll(/(?:Assets\/)?[^\s]+\.cs/g)) {
    const rawPath = match[0];

    // Siempre normalizar a "Assets/.../file.cs"
    const normalized = rawPath.startsWith("Assets/")
      ? rawPath
      : `Assets/${rawPath}`;

    console.log(`🧩 Ruta detectada: ${normalized}`);

    // Guardar siempre la normalizada
    filePaths.push(normalized);
  }

  if (filePaths.length === 0) {
    console.warn("No se encontraron rutas de dependencias en la respuesta.");
    return null;
  }

  // Leer y concatenar contenido de dependencias
  const dependenciesContent = getClassContents(filePaths);

  return `### Additional Class Definitions
${dependenciesContent}

These are the required class definitions needed to complete the requested test generation. Please continue generating the tests using this additional context.`;
}

/**
 * Lee el contenido de las clases especificadas y concatena sus textos.
 * Corrige rutas duplicadas como "Assets/Assets/".
 *
 * @param {string[]} filePaths - Lista de rutas empezando con "Assets/".
 * @returns {string} Contenido concatenado.
 */
function getClassContents(filePaths: string[]): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return "";

  const rootPath = workspaceFolders[0].uri.fsPath;
  let combinedContent = "";

  for (const file of filePaths) {
    // Quitar el prefijo "Assets/" porque rootPath YA termina en ".../Assets"
    const relative = file.replace(/^Assets\//, "");

    // Construir la ruta final
    const absolutePath = path.join(rootPath, relative);

    if (fs.existsSync(absolutePath)) {
      console.log(`✅ Se obtuvo la ruta exitosamente: ${absolutePath}`);
      const content = fs.readFileSync(absolutePath, "utf8");
      combinedContent += `\n\n// File: ${file}\n${content}`;
    } else {
      console.warn(`❌ No se obtuvo la ruta exitosamente: ${absolutePath}`);
    }
  }

  return combinedContent;
}
