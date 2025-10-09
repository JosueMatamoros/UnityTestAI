import * as fs from 'fs';
import * as path from 'path';

/**
 * Carga la lista de modelos disponibles de OpenRouter desde un archivo JSON local
 * ubicado en ./openrouter.models.json
 *
 * @param {string} extensionPath - Ruta absoluta a la carpeta raíz de la extensión.
 * @returns {any[]} Lista de modelos cargados desde el archivo JSON.  
 */
export function loadOpenRouterModels(extensionPath: string): any[] {
  const jsonPath = path.join(extensionPath, "openrouter.models.json");
  try {
    const raw = fs.readFileSync(jsonPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("No se pudo leer el archivo de modelos de OpenRouter:", err);
    return [];
  }
}
