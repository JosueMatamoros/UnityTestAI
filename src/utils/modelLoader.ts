import * as fs from 'fs';
import * as path from 'path';

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
