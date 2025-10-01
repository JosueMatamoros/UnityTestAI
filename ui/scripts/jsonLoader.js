export function initJsonLoader() {
  const browseBtn = document.getElementById("loadJsonBtn");
  const fileInput = document.getElementById("jsonFileInput");

  if (!browseBtn || !fileInput) return;

  // Al hacer click en el botón, disparamos el input
  browseBtn.addEventListener("click", () => {
    fileInput.click();
  });

  // Cuando seleccionan un archivo
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const text = await file.text();
    try {
      const config = JSON.parse(text);

      if (!config.className || !config.methodName || !config.model) {
        throw new Error("Faltan campos obligatorios (className, methodName, model).");
      }
      if (config.model === "openrouter" && !config.subModel) {
        throw new Error("El modelo 'openrouter' requiere subModel.");
      }

      // Usa window.vscode porque el acquireVsCodeApi() ya está en main.js
      window.vscode.postMessage({
        command: "generateFromConfig",
        className: config.className,
        methodName: config.methodName,
        model: config.model,
        subModel: config.subModel || null,
      });
    } catch (err) {
      window.vscode.postMessage({
        command: "log",
        text: `Error en JSON: ${err.message}`,
      });
    }
  });
}
