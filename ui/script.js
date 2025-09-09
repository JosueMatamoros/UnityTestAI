hljs.highlightAll();
const vscode = acquireVsCodeApi();

const toggleBtn = document.getElementById("toggleBtn");
const codeContainer = document.getElementById("codeContainer");
const generateBtn = document.getElementById("generateBtn");
const resultCard = document.getElementById("resultCard");
const resultContainer = document.getElementById("resultContainer");
const typingIndicator = document.getElementById("typingIndicator");
const copyBtn = document.getElementById("copyBtn");
// refs actuales (deja los tuyos tal cual)
const currentStep = document.getElementById("currentStep");
const stepperFill = document.getElementById("stepperFill");
const stepLabel = document.getElementById("stepLabel");
const stepInput = document.getElementById("stepInput");
const stepperBox = document.getElementById("stepper");
const readyBadge = document.getElementById("readyBadge");

let step = 0; // 0 = pedir clase, 1 = pedir método, 2 = listo
let classNameVal = "";
let methodNameVal = "";

function updateStepper(stepNum) {
  currentStep.textContent = stepNum;
  stepperFill.style.width =
    stepNum === 0 ? "0%" : stepNum === 1 ? "50%" : "100%";
}

function setStep(newStep) {
  step = newStep;

  if (step < 2) {
    if (stepperBox) stepperBox.style.display = "";
    if (readyBadge) readyBadge.style.display = "none";

    if (step === 0) {
      stepLabel.textContent = "Nombre de la clase";
      stepInput.placeholder = "Utilities";
      stepInput.value = classNameVal;
    } else {
      stepLabel.textContent = "Nombre del método";
      stepInput.placeholder = "CheckHorizontal1";
      stepInput.value = methodNameVal;
    }
  } else {
    // Paso 2: todo listo
    if (stepperBox) stepperBox.style.display = "none";
    if (readyBadge) readyBadge.style.display = "";
    // Deja el input con el último contexto (método) por si quiere corregir
    stepLabel.textContent = "Nombre del método";
    stepInput.placeholder = "CheckHorizontal1";
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
    setStep(1); // pasa a pedir método
  } else if (step === 1) {
    methodNameVal = val;
    setStep(2); // listo
  } else {
    // Paso 2: tercer Enter => click en generar
    document.getElementById("generateBtn")?.click();
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

    vscode.postMessage({
      command: "inputsProvided",
      className: classNameVal.trim(),
      methodName: methodNameVal.trim(),
    });
  }
});
