// Resalta todo el código
hljs.highlightAll();
// API de VSCode
const vscode = acquireVsCodeApi();

// Avisar al backend que ya se cargó el DOM
window.addEventListener("DOMContentLoaded", () => {
  vscode.postMessage({ command: "webviewReady" });
});

// Botón para togglear el contenedor de código (input) y su contenedor
const toggleBtn = document.getElementById("toggleBtn");
const codeContainer = document.getElementById("codeContainer");
// Botón para generar pruebas y contenedor de resultados
const generateBtn = document.getElementById("generateBtn");
const resultCard = document.getElementById("resultCard");
const resultContainer = document.getElementById("resultContainer");
// Indicador de tipeo y botón de copiar
const typingIndicator = document.getElementById("typingIndicator");
const copyBtn = document.getElementById("copyBtn");
// Elementos del stepper
const currentStep = document.getElementById("currentStep");
const stepperFill = document.getElementById("stepperFill");
const stepperBox = document.getElementById("stepper");
// Elementos del input y su label
const stepLabel = document.getElementById("stepLabel");
const stepInput = document.getElementById("stepInput");
// Badge de listo (tercer paso)
const readyBadge = document.getElementById("readyBadge");
// Sub-modelos de OpenRouters
let subSelect = null;

let step = 0; // 0 = pedir clase, 1 = pedir método, 2 = listo
let classNameVal = "";
let methodNameVal = "";
let selectedModel = null;
let selectedSubModel = null;

function updateStepper(stepNum) {
  // Actualiza el stepper visual
  currentStep.textContent = stepNum;
  stepperFill.style.width =
    stepNum === 0 ? "0%" : stepNum === 1 ? "50%" : "100%";
}

function setStep(newStep) {
  step = newStep;

  if (step < 2) {
    if (stepperBox) stepperBox.style.display = "";
    if (readyBadge) readyBadge.style.display = "none";
    if (stepLabel) stepLabel.style.display = "";
    if (stepInput) stepInput.style.display = "";

    if (step === 0) {
      stepLabel.textContent = "Nombre de la clase";
      stepInput.placeholder = "Utilities";
      stepInput.value = classNameVal;
    } else {
      stepLabel.textContent = "Nombre del método";
      stepInput.placeholder = "CheckHorizontal1";
      stepInput.value = methodNameVal;
    }
  } else if (step === 2) {
    if (stepperBox) stepperBox.style.display = "none";
    if (readyBadge) readyBadge.style.display = "";
    if (stepLabel) stepLabel.style.display = "none";
    if (stepInput) stepInput.style.display = "none";
  }

  updateStepper(step);
  stepInput.focus();
}

// Inicializa en 0
setStep(0);

// Avance con Enter (tercer Enter dispara generar)
stepInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;

  const val = stepInput.value.trim();
  if (!val) {
    stepInput.classList.add("error");
    setTimeout(() => stepInput.classList.remove("error"), 900);
    return;
  }

  if (step === 0) {
    classNameVal = val;
    setStep(1);
  } else if (step === 1) {
    methodNameVal = val;
    vscode.postMessage({
      command: "validateInputs",
      className: classNameVal.trim(),
      methodName: methodNameVal.trim(),
    });
  }
});

// Toggle código
toggleBtn.addEventListener("click", () => {
  codeContainer.classList.toggle("collapsed");
  toggleBtn.textContent = codeContainer.classList.contains("collapsed")
    ? "Mostrar código"
    : "Ocultar código";
});

// Generar pruebas
generateBtn.addEventListener("click", () => {
  resultCard.style.display = "block";
  typingIndicator.style.display = "flex";
  resultContainer.innerText = "";

  vscode.postMessage({
    command: "generateTest",
    model: selectedModel,
    subModel: selectedSubModel,
  });
});

// Recibir respuesta del backend al recibir los resultados del LLM
window.addEventListener("message", (event) => {
  const message = event.data;

  if (message.command === "showResult") {
    typingIndicator.style.display = "none";

    const raw = message.result;
    const regex = /```csharp([\s\S]*?)```/gi;
    const segments = [];
    let lastIndex = 0;
    let match;

    // divide en texto/código
    while ((match = regex.exec(raw)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          type: "text",
          content: raw.slice(lastIndex, match.index),
        });
      }
      segments.push({ type: "code", content: match[1] });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < raw.length) {
      segments.push({ type: "text", content: raw.slice(lastIndex) });
    }

    // construye el HTML
    let html = "";
    segments.forEach((seg) => {
      if (seg.type === "code") {
        html += `
        <div class="code-block">
          <pre><code class="language-cs">${seg.content
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</code></pre>
        </div>
      `;
      } else {
        const text = seg.content.trim();
        if (text) {
          html += `<div class="text-block">${text
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</div>`;
        }
      }
    });

    resultContainer.innerHTML = html;
    hljs.highlightAll();

    // botón de copiar solo el código
    const codeOnly = segments
      .filter((s) => s.type === "code")
      .map((s) => s.content)
      .join("\n\n");

    copyBtn.onclick = () => {
      navigator.clipboard.writeText(codeOnly);
      copyBtn.textContent = "Copiado!";
      setTimeout(() => (copyBtn.textContent = "Copiar"), 2000);
    };
  }
  // Llena el select de modelos
  if (message.command === "setModels") {
    const container = document.getElementById("modelMenuContainer");
    container.innerHTML = "";

    const dropdown = document.createElement("div");
    dropdown.className = "dropdown";

    const trigger = document.createElement("button");
    trigger.className = "dropbtn";
    trigger.id = "modelBtn";
    trigger.textContent = "Selecciona modelo";

    const dropdownContent = document.createElement("div");
    dropdownContent.className = "dropdown-content";

    message.models.forEach((m) => {
      if (m.id === "openrouter") {
        // Crear item con submenu vacío
        const submenu = document.createElement("div");
        submenu.className = "submenu";

        const submenuTitle = document.createElement("a");
        submenuTitle.className = "submenu-title";
        submenuTitle.textContent = "OpenRouter";

        const submenuContent = document.createElement("div");
        submenuContent.className = "submenu-content";
        submenuContent.id = "openRouterSubmenu";

        submenu.appendChild(submenuTitle);
        submenu.appendChild(submenuContent);
        dropdownContent.appendChild(submenu);
      } else {
        // Modelos normales
        const item = document.createElement("a");
        item.textContent = m.name;
        item.dataset.model = m.id;
        item.addEventListener("click", () => {
          selectedModel = m.id;
          selectedSubModel = null;
          trigger.textContent = m.name;
        });
        dropdownContent.appendChild(item);
      }
    });

    dropdown.appendChild(trigger);
    dropdown.appendChild(dropdownContent);
    container.appendChild(dropdown);
  }

  if (message.command === "setSubModels") {
    const submenuContent = document.getElementById("openRouterSubmenu");
    submenuContent.innerHTML = "";

    message.subModels.forEach((m, i) => {
      const subItem = document.createElement("a");
      subItem.textContent = m.label;
      subItem.dataset.model = m.model;

      subItem.addEventListener("click", () => {
        selectedModel = "openrouter";
        selectedSubModel = m.model; 
        document.getElementById("modelBtn").textContent = m.label;
        vscode.postMessage({
          command: "log",
          text: `Seleccionado: ${m.label} (${m.model})`, 
        });
      });

      submenuContent.appendChild(subItem);

      if (i === 0) {
        selectedModel = "openrouter";
        selectedSubModel = m.model;
        document.getElementById("modelBtn").textContent = m.label;
      }
    });
  }

  // Responde al requestInputs del backend
  if (message.command === "requestInputs") {
    // sincroniza por si escribió sin Enter
    const pending = stepInput.value.trim();
    if (step === 0) classNameVal = pending || classNameVal;
    if (step === 1) methodNameVal = pending || methodNameVal;

    const hasClass = (classNameVal || "").trim().length > 0;
    const hasMethod = (methodNameVal || "").trim().length > 0;

    if (!hasClass) setStep(0);
    else if (!hasMethod) setStep(1);
    else setStep(2);

    if (!hasClass || !hasMethod) {
      stepInput.classList.add("error");
      setTimeout(() => stepInput.classList.remove("error"), 900);
      vscode.postMessage({ command: "inputsCancelled" });
      typingIndicator.style.display = "none";
      return;
    }

    // Envía los inputs al backend
    vscode.postMessage({
      command: "inputsProvided",
      className: classNameVal.trim(),
      methodName: methodNameVal.trim(),
    });
  }
  // La clase o el método no coincide, {se vuelven a solicitar}
  if (message.command === "resetInputs") {
    classNameVal = "";
    methodNameVal = "";
    setStep(0);
    typingIndicator.style.display = "none";
    resultCard.style.display = "none";
  }

  // Todo listo para hacer la solicitud
  if (message.command === "goToStep2") {
    setStep(2);

    // Mostrar tarjeta y loader
    resultCard.style.display = "block";
    typingIndicator.style.display = "flex";
    resultContainer.innerText = "";

    vscode.postMessage({
      command: "generateTest",
      model: selectedModel,
      subModel: selectedSubModel,
    });
  }
});
