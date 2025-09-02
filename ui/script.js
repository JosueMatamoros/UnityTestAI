hljs.highlightAll();
const vscode = acquireVsCodeApi();

const toggleBtn = document.getElementById("toggleBtn");
const codeContainer = document.getElementById("codeContainer");
const generateBtn = document.getElementById("generateBtn");
const resultCard = document.getElementById("resultCard");
const resultContainer = document.getElementById("resultContainer");
const typingIndicator = document.getElementById("typingIndicator");
const copyBtn = document.getElementById("copyBtn");

// Toggle código
toggleBtn.addEventListener("click", () => {
  codeContainer.classList.toggle("collapsed");
  toggleBtn.textContent = codeContainer.classList.contains("collapsed")
    ? "Mostrar código"
    : "Ocultar código";
});

// Generar pruebas
generateBtn.addEventListener("click", () => {
  // Mostrar tarjeta resultado 
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
    typingIndicator.style.display = "none";

    let cleanResult = message.result
      .replace(/```csharp\s*/gi, "")
      .replace(/```/g, "");

    resultContainer.innerHTML = `
      <div class="code-block">
        <pre><code class="language-cs">${cleanResult
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</code></pre>
      </div>
    `;

    hljs.highlightAll();
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(cleanResult);
      copyBtn.textContent = "Copiado!";
      setTimeout(() => (copyBtn.textContent = "Copiar"), 2000);
    };
  }
});
