// Resalta todo el código
hljs.highlightAll();
// API de VSCode
const vscode = acquireVsCodeApi();

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
  // Mostrar tarjeta resultado
  resultCard.style.display = "block";
  typingIndicator.style.display = "flex";
  resultContainer.innerText = "";

  const model = document.getElementById("modelSelect").value;
  const subModelEl = document.getElementById("openRouterSub");
  const subModel =
    subModelEl && subModelEl.style.display !== "none" ? subModelEl.value : null;
  // Llamar a generateTest en el backend
  vscode.postMessage({ command: "generateTest", model, subModel });
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
    const select = document.getElementById("modelSelect");
    select.innerHTML = "";
    message.models.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => {
      if (subSelect)
        subSelect.style.display =
          select.value === "openrouter" ? "inline-block" : "none";
    });
  }

  if (message.command === "setSubModels") {
    subSelect = document.createElement("select");
    subSelect.id = "openRouterSub";
    subSelect.style.display = "none";
    message.subModels.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.model;
      opt.textContent = m.label;
      subSelect.appendChild(opt);
    });
    document.querySelector(".actions").appendChild(subSelect);
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

    const model = document.getElementById("modelSelect").value;
    const subEl = document.getElementById("openRouterSub");
    const subModel =
      subEl && subEl.style.display !== "none" ? subEl.value : null;

    vscode.postMessage({
      command: "generateTest",
      model,
      subModel,
    });
  }
});
