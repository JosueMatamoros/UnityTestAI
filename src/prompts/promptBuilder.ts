import * as fs from 'fs';
import * as path from 'path';

/**
 * Construye el prompt completo sustituyendo los placeholders.
 * - <method-name>  → nombre del método objetivo
 * - <class-name>   → nombre de la clase objetivo
 * - {code}         → código C# del método/clase
 * - ${projectTree} → estructura de proyecto generada dinámicamente
 */
export function buildPrompt(
  methodName: string,
  className: string,
  code: string,
  projectTree: string
): string {
  const promptPath = path.join(__dirname, "..", "prompts", "basePrompt.txt");

  if (!fs.existsSync(promptPath)) {
    throw new Error(`No se encontró el archivo basePrompt.txt en: ${promptPath}`);
  }

  let prompt = fs.readFileSync(promptPath, "utf8");

  const finalPrompt = prompt
    .replace("<method-name>", methodName)
    .replace("<class-name>", className)
    .replace("{code}", code)
    .replace("${projectTree}", projectTree || "(Project structure not available)");

  return finalPrompt;
}
