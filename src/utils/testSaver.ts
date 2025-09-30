// src/utils/testSaver.ts
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * Guarda un archivo de prueba en la carpeta Assets/Tests de Unity
 * @param workspaceRoot Ruta raíz del proyecto Unity (donde está Assets/)
 * @param code Código C# generado por el LLM
 * @param className Nombre de la clase original que se está probando
 * @param model Nombre del modelo usado (ej. ChatGPT, DeepSeek)
 */
export function saveUnityTest(workspaceRoot: string, code: string, className: string, model: string) {
  try {
    const unityTestsPath = path.join(workspaceRoot, "Tests");

    // Validar carpeta Assets/Tests
    if (!fs.existsSync(unityTestsPath)) {
      vscode.window.showErrorMessage("La carpeta Assets/Tests/ no existe en el proyecto Unity.");
      return;
    }

    // Validar que exista un .asmdef
    const hasAsmdef = fs.readdirSync(unityTestsPath).some(f => f.endsWith(".asmdef"));
    if (!hasAsmdef) {
      vscode.window.showErrorMessage("No se encontró un archivo .asmdef en Assets/Tests/. Unity no reconocerá los tests.");
      return;
    }
    // Limpiar etiquetas de markdown 
    let cleanCode = code.replace(/```(csharp|cs)?/gi, "").trim();

    // Nombre del archivo 
    const safeClassName = `UTIA_${model}_${className}`;
    const filePath = path.join(unityTestsPath, `${safeClassName}.cs`);
    // Reemplazar el nombre de la clase
    cleanCode = cleanCode.replace(/public\s+class\s+\w+/, `public class ${safeClassName}`);
    
    // Guardar archivo
    fs.writeFileSync(filePath, cleanCode, "utf8");

    vscode.window.showInformationMessage(`Test guardado en: ${filePath}`);
  } catch (err: any) {
    vscode.window.showErrorMessage(` Error al guardar el test: ${err.message}`);
  }
}
