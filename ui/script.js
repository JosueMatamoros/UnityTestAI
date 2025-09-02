hljs.highlightAll();
const vscode = acquireVsCodeApi();

const toggleBtn = document.getElementById("toggleBtn");
const codeContainer = document.getElementById("codeContainer");
const generateBtn = document.getElementById("generateBtn");
const resultCard = document.getElementById("resultCard");
const resultContainer = document.getElementById("resultContainer");
const typingIndicator = document.getElementById("typingIndicator");

// Toggle código
toggleBtn.addEventListener("click", () => {
  codeContainer.classList.toggle("collapsed");
  toggleBtn.textContent = codeContainer.classList.contains("collapsed")
    ? "Mostrar código"
    : "Ocultar código";
});

// Generar pruebas
generateBtn.addEventListener("click", () => {
  // Mostrar tarjeta resultado + animación
  resultCard.style.display = "block";
  typingIndicator.style.display = "flex";
  resultContainer.innerText = "";

  // Simulación de llamada al backend
  vscode.postMessage({ command: "generateTest" });
});

// Recibir respuesta del backend
window.addEventListener("message", (event) => {
  const message = event.data;

  if (message.command === "showResult") {
    // Ocultar animación
    typingIndicator.style.display = "none";

    // Mostrar el resultado
    resultContainer.innerHTML =
      "<pre><code class='language-cs'>" +
      message.result.replace(/</g, "&lt;").replace(/>/g, "&gt;") +
      "</code></pre>";
    hljs.highlightAll();
  }
});
