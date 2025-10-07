import { showLoading, switchToChat } from "../domUtils";

export function initJsonLoader() {
  const browseBtn = document.getElementById("loadJsonBtn");
  const fileInput = document.getElementById("jsonFileInput");
  const resultCard = document.getElementById("resultCard");
  const typingIndicator = document.getElementById("typingIndicator");
  const resultContainer = document.getElementById("resultContainer");
  const stepper = document.getElementById("stepper");
  const jsonContainer = document.getElementById("configLoader");
  const actionsContainer = document.getElementById("actions");
  const chatActionsContainer = document.getElementById("chatActions");

  if (!browseBtn || !fileInput) return;

  browseBtn.addEventListener("click", () => {
    fileInput.click();
  });

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

      // Mostrar UI de resultado y spinner
      showLoading(resultCard, typingIndicator, resultContainer);
      switchToChat(stepper, jsonContainer, actionsContainer, chatActionsContainer);

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
