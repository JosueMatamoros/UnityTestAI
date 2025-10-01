import { toggleElement } from "./domUtils.js";
import { renderResult } from "./resultRenderer.js";
import { getStepperState, setStepperState, applyStepUI } from "./stepper.js";
import { setModels, setSubModels, getSelectedModel } from "./modelMenu.js";
import { initJsonLoader } from "./jsonLoader.js";
import "../styles/main.css";

const vscode = acquireVsCodeApi();
window.vscode = vscode;

// DOM refs
const toggleBtn = document.getElementById("toggleBtn");
const codeContainer = document.getElementById("codeContainer");
const generateBtn = document.getElementById("generateBtn");
const resultCard = document.getElementById("resultCard");
const resultContainer = document.getElementById("resultContainer");
const typingIndicator = document.getElementById("typingIndicator");
const copyBtn = document.getElementById("copyBtn");
const currentStep = document.getElementById("currentStep");
const stepperFill = document.getElementById("stepperFill");
const stepperBox = document.getElementById("stepper");
const stepLabel = document.getElementById("stepLabel");
const stepInput = document.getElementById("stepInput");
const readyBadge = document.getElementById("readyBadge");

hljs.highlightAll();
initJsonLoader();

// Avísale al backend que el DOM está listo
window.addEventListener("DOMContentLoaded", () => {
  vscode.postMessage({ command: "webviewReady" });
});

// Inicializa stepper
applyStepUI(0, { currentStep, stepperFill, stepperBox, readyBadge, stepLabel, stepInput });
setStepperState(0, "", "");

// Avance con Enter
stepInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const val = stepInput.value.trim();
  if (!val) {
    stepInput.classList.add("error");
    setTimeout(() => stepInput.classList.remove("error"), 900);
    return;
  }

  const { step, classNameVal } = getStepperState();

  if (step === 0) {
    setStepperState(1, val, undefined);
    applyStepUI(1, { currentStep, stepperFill, stepperBox, readyBadge, stepLabel, stepInput });
  } else if (step === 1) {
    setStepperState(1, undefined, val);
    const { methodNameVal } = getStepperState();
    vscode.postMessage({
      command: "validateInputs",
      className: classNameVal.trim(),
      methodName: methodNameVal.trim(),
    });
  }
});

// Toggle código usando domUtils
toggleBtn.addEventListener("click", () => {
  toggleElement(codeContainer, "collapsed");
  toggleBtn.textContent = codeContainer.classList.contains("collapsed")
    ? "Mostrar código"
    : "Ocultar código";
});

// Generar pruebas
generateBtn.addEventListener("click", () => {
  resultCard.style.display = "block";
  typingIndicator.style.display = "flex";
  resultContainer.innerText = "";

  const { selectedModel, selectedSubModel } = getSelectedModel();
  vscode.postMessage({
    command: "generateTest",
    model: selectedModel,
    subModel: selectedSubModel,
  });
});

// Mensajes del backend
window.addEventListener("message", (event) => {
  const message = event.data;

  if (message.command === "showResult") {
    typingIndicator.style.display = "none";
    renderResult(message.result, resultContainer, copyBtn);
  }

  if (message.command === "setModels") {
    setModels(message.models, document.getElementById("modelMenuContainer"), "modelBtn", vscode);
  }

  if (message.command === "setSubModels") {
    setSubModels(message.subModels, document.getElementById("openRouterSubmenu"), "modelBtn", vscode);
  }

  if (message.command === "requestInputs") {
    const pending = stepInput.value.trim();
    const state = getStepperState();
    if (state.step === 0 && pending) setStepperState(0, pending, state.methodNameVal);
    if (state.step === 1 && pending) setStepperState(1, state.classNameVal, pending);

    const { classNameVal, methodNameVal } = getStepperState();
    const hasClass = (classNameVal || "").trim().length > 0;
    const hasMethod = (methodNameVal || "").trim().length > 0;

    if (!hasClass || !hasMethod) {
      stepInput.classList.add("error");
      setTimeout(() => stepInput.classList.remove("error"), 900);
      vscode.postMessage({ command: "inputsCancelled" });
      typingIndicator.style.display = "none";
      return;
    }

    setStepperState(2, classNameVal, methodNameVal);
    applyStepUI(2, { currentStep, stepperFill, stepperBox, readyBadge, stepLabel, stepInput });

    vscode.postMessage({
      command: "inputsProvided",
      className: classNameVal.trim(),
      methodName: methodNameVal.trim(),
    });
  }

  if (message.command === "resetInputs") {
    setStepperState(0, "", "");
    applyStepUI(0, { currentStep, stepperFill, stepperBox, readyBadge, stepLabel, stepInput });
    typingIndicator.style.display = "none";
    resultCard.style.display = "none";
  }

  if (message.command === "goToStep2") {
    setStepperState(2, undefined, undefined);
    applyStepUI(2, { currentStep, stepperFill, stepperBox, readyBadge, stepLabel, stepInput });

    resultCard.style.display = "block";
    typingIndicator.style.display = "flex";
    resultContainer.innerText = "";

    const { selectedModel, selectedSubModel } = getSelectedModel();
    vscode.postMessage({
      command: "generateTest",
      model: selectedModel,
      subModel: selectedSubModel,
    });
  }
});
