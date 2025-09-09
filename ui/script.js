hljs.highlightAll();
const vscode = acquireVsCodeApi();

const toggleBtn = document.getElementById("toggleBtn");
const codeContainer = document.getElementById("codeContainer");
const generateBtn = document.getElementById("generateBtn");
const resultCard = document.getElementById("resultCard");
const resultContainer = document.getElementById("resultContainer");
const typingIndicator = document.getElementById("typingIndicator");
const copyBtn = document.getElementById("copyBtn");
const classNameInput = document.getElementById("classNameInput");
const methodNameInput = document.getElementById("methodNameInput");

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

  const model = document.getElementById("modelSelect").value;
  // Simulación de llamada al backend
  vscode.postMessage({ command: "generateTest", model });
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
  if (message.command === "setModels") {
    const select = document.getElementById("modelSelect");
    select.innerHTML = "";
    message.models.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      select.appendChild(opt);
    });
  }
  
  if (message.command === "requestInputs") {
    const className = (classNameInput.value || "").trim();
    const methodName = (methodNameInput.value || "").trim();

    if (!className || !methodName) {
      vscode.postMessage({ command: "inputsCancelled" });
      typingIndicator.style.display = "none";
      return;
    }

    vscode.postMessage({
      command: "inputsProvided",
      className,
      methodName
    });
  }
});
