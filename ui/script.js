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
  // Llamar a generateTest en el backend
  vscode.postMessage({ command: "generateTest", model });
});

// Recibir respuesta del backend al recibir los resultados del LLM
window.addEventListener("message", (event) => {
  const message = event.data;

  if (message.command === "showResult") {
    typingIndicator.style.display = "none";

    // Limpia el resultado de los backticks
    let cleanResult = message.result
      .replace(/```csharp\s*/gi, "")
      .replace(/```/g, "");

    // Mostrar resultado en el contenedor de resultados
    resultContainer.innerHTML = `
      <div class="code-block">
        <pre><code class="language-cs">${cleanResult
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</code></pre>
      </div>
    `;
    // Resalta el código y configura el botón de copiar
    hljs.highlightAll();
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(cleanResult);
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
      model: document.getElementById("modelSelect").value,
    });
  }
});
