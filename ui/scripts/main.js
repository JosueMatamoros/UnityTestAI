// ./main.js

import { toggleElement } from "./domUtils.js";
import { renderResult } from "./managers/resultRendererManager.js";
import { getStepperState, setStepperState, applyStepUI } from "./stepper.js";
import { setModels, setSubModels, getSelectedModel } from "./modelMenu.js";
import { initJsonLoader } from "./managers/jsonLoaderManager.js";
import {
  showChatUI,
  showLoadingUI,
  hideLoadingUI,
  resetUI,
  updateAgentStatus,
  clearAgentPipeline,
  showDependencyFilesList,
  showContextBuilderSlices,
} from "./managers/uiManager.js";
import { initChat, appendChatMessage } from "./managers/chatManager.js";
import "../styles/main.css";

/* ============================
   Inicialización del entorno
============================ */

// Instancia del API de VS Code para comunicación con la extensión
const vscode = acquireVsCodeApi();
window.vscode = vscode;

/* ============================
   Referencias DOM principales
============================ */

const toggleBtn = document.getElementById("toggleBtn"); // Botón para mostrar/ocultar bloque de código
const codeContainer = document.getElementById("codeContainer"); // Contenedor del código fuente (C#)
const generateBtn = document.getElementById("generateBtn"); // Botón para generar las pruebas
const resultContainer = document.getElementById("resultContainer"); // Contenedor del resultado del LLM
const copyBtn = document.getElementById("copyBtn"); // Botón para copiar el resultado del LLM
const genTimeBadge = document.getElementById("genTimeBadge"); // Tiempo total de generación
const genTokenBadge = document.getElementById("genTokenBadge"); // Tokens totales de la sesión
const currentStep = document.getElementById("currentStep"); // Texto del paso actual (1 de 2)
const stepperFill = document.getElementById("stepperFill"); // Barra de progreso del stepper
const stepperBox = document.getElementById("stepper"); // Contenedor completo del stepper
const stepLabel = document.getElementById("stepLabel"); // Etiqueta descriptiva del paso actual
const stepInput = document.getElementById("stepInput"); // Input donde se ingresa el valor del paso actual
const readyBadge = document.getElementById("readyBadge"); // Insignia que indica que los pasos están completos
const chatInput = document.getElementById("chatInput"); // Input del chat con el LLM
const chatSendBtn = document.getElementById("chatSendBtn"); // Botón para enviar mensajes al LLM

/* ============================
   Inicialización de módulos
============================ */

// Inicializa resaltado de sintaxis en bloques <pre><code>
hljs.highlightAll();

// Permite cargar una configuración de prueba desde un archivo JSON
initJsonLoader();

// Configura el sistema de chat (entrada y envío)
initChat(vscode, chatInput, chatSendBtn);

// Notifica al backend cuando el DOM está listo
window.addEventListener("DOMContentLoaded", () => {
  vscode.postMessage({ command: "webviewReady" });
});

/* ============================
   Configuración del stepper
============================ */

// Inicializa el stepper en el paso 0
applyStepUI(0, {
  currentStep,
  stepperFill,
  stepperBox,
  readyBadge,
  stepLabel,
  stepInput,
});
setStepperState(0, "", "");

// Permite avanzar entre pasos presionando Enter
stepInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const val = stepInput.value.trim();

  // Validar que el campo no esté vacío
  if (!val) {
    stepInput.classList.add("error");
    setTimeout(() => stepInput.classList.remove("error"), 900);
    return;
  }

  const { step, classNameVal } = getStepperState();

  // Paso 0: solicitar nombre de la clase
  if (step === 0) {
    setStepperState(1, val, undefined);
    applyStepUI(1, {
      currentStep,
      stepperFill,
      stepperBox,
      readyBadge,
      stepLabel,
      stepInput,
    });
  }
  // Paso 1: solicitar nombre del método y validar entradas
  else if (step === 1) {
    setStepperState(1, undefined, val);
    const { methodNameVal } = getStepperState();

    // Enviar los datos (clase y método) al backend para validación
    vscode.postMessage({
      command: "validateInputs",
      className: classNameVal.trim(),
      methodName: methodNameVal.trim(),
    });
  }
});

/* ============================
   Interacción con la UI
============================ */

// Alternar visibilidad del bloque de código fuente (Asset C#)
toggleBtn.addEventListener("click", () => {
  toggleElement(codeContainer, "collapsed");
  toggleBtn.textContent = codeContainer.classList.contains("collapsed")
    ? "Mostrar código"
    : "Ocultar código";
});

// Generar pruebas
generateBtn.addEventListener("click", () => {
  showLoadingUI();
  const { selectedModel, selectedSubModel } = getSelectedModel();

  vscode.postMessage({
    command: "generateTest",
    model: selectedModel,
    subModel: selectedSubModel,
  });
});

/* ============================
   Tiempo de generación
============================ */

// Formatea milisegundos a un texto legible (ej: "1.8 s" o "1 m 12 s")
function formatElapsed(ms) {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)} s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes} m ${seconds} s`;
}

// Muestra el tiempo total de generación en el badge (arriba a la derecha)
function showGenTime(ms) {
  if (!genTimeBadge || typeof ms !== "number") return;
  genTimeBadge.textContent = formatElapsed(ms);
  genTimeBadge.style.display = "inline-flex";
}

// Formatea un conteo de tokens (ej: "950 tok" o "8.2k tok")
function formatTokens(n) {
  if (n < 1000) return `${n} tok`;
  return `${(n / 1000).toFixed(1)}k tok`;
}

// Muestra los tokens totales consumidos en la sesión de generación
function showGenTokens(total) {
  if (!genTokenBadge || typeof total !== "number") return;
  genTokenBadge.textContent = formatTokens(total);
  genTokenBadge.title = `${total.toLocaleString()} tokens (entrada + salida) en esta generación`;
  genTokenBadge.style.display = "inline-flex";
}

/* ============================
   Comunicación con el backend
============================ */

window.addEventListener("message", (event) => {
  const message = event.data;

  switch (message.command) {
    /* ----------------------------------------
      Mostrar la respuesta generada por el LLM
    ---------------------------------------- */
    case "agentStatus":
      // Hide the typing indicator — agent pipeline replaces it
      hideLoadingUI();
      updateAgentStatus(message.agent, message.status, message.detail);
      break;

    case "clearPipeline":
      clearAgentPipeline();
      if (genTimeBadge) genTimeBadge.style.display = "none";
      if (genTokenBadge) genTokenBadge.style.display = "none";
      break;

    case "dependencyFiles":
      showDependencyFilesList(message.files);
      break;

    case "contextBuilderSlices":
      showContextBuilderSlices(message.slices);
      break;

    case "agentError": {
      // Mark the currently-running agent step as error (red)
      const running = document.querySelector(".agent-step--running");
      if (running) {
        const name = running.getAttribute("data-agent") || "Agent";
        updateAgentStatus(name, "error", message.message);
      }
      hideLoadingUI();
      break;
    }

    case "generationError":
      hideLoadingUI();
      break;

    case "showResult":
      hideLoadingUI();
      clearAgentPipeline();
      renderResult(message.result, resultContainer, copyBtn);
      showGenTime(message.elapsedMs);
      showGenTokens(message.totalTokens);
      showChatUI();
      break;

    case "updateResult": {
      // Chat Fixer correction — update the code panel WITHOUT clearing the agent pipeline
      renderResult(message.result, resultContainer, copyBtn);
      // Flash the result card green to signal the update
      const card = resultContainer.closest
        ? resultContainer.closest("[id]")
        : null;
      const target = document.getElementById("resultCard") || resultContainer;
      target.style.transition = "box-shadow 0.3s ease";
      target.style.boxShadow = "0 0 0 2px #4caf50";
      setTimeout(() => { target.style.boxShadow = ""; }, 1400);
      // Scroll the result into view
      resultContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
      break;
    }

    case "showDependencyResult":
      hideLoadingUI();
      renderResult(message.result, resultContainer, copyBtn, true);
      showChatUI();
      break;
    /* ----------------------------------------
      Poblar el menú de modelos LLM disponibles
    ---------------------------------------- */
    case "setModels":
      setModels(
        message.models,
        document.getElementById("modelMenuContainer"),
        "modelBtn",
        vscode
      );
      break;

    /* ----------------------------------------
      Poblar submodelos (OpenRouter)
    ---------------------------------------- */
    case "setSubModels":
      setSubModels(
        message.subModels,
        document.getElementById("openRouterSubmenu"),
        "modelBtn",
        vscode
      );
      break;

    /* ----------------------------------------
      Solicitar entradas de clase y método
    ---------------------------------------- */
    case "requestInputs": {
      const pending = stepInput.value.trim();
      const state = getStepperState();

      if (state.step === 0 && pending)
        setStepperState(0, pending, state.methodNameVal);
      if (state.step === 1 && pending)
        setStepperState(1, state.classNameVal, pending);

      const { classNameVal, methodNameVal } = getStepperState();
      const hasClass = (classNameVal || "").trim().length > 0;
      const hasMethod = (methodNameVal || "").trim().length > 0;

      // Validar que ambos valores existan antes de continuar
      if (!hasClass || !hasMethod) {
        stepInput.classList.add("error");
        setTimeout(() => stepInput.classList.remove("error"), 900);
        vscode.postMessage({ command: "inputsCancelled" });
        hideLoadingUI();
        return;
      }

      // Si todo está correcto, avanzar al paso 2
      setStepperState(2, classNameVal, methodNameVal);
      applyStepUI(2, {
        currentStep,
        stepperFill,
        stepperBox,
        readyBadge,
        stepLabel,
        stepInput,
      });

      vscode.postMessage({
        command: "inputsProvided",
        className: classNameVal.trim(),
        methodName: methodNameVal.trim(),
      });
      break;
    }
    /* ----------------------------------------
        Reiniciar los campos de entrada y UI
    ---------------------------------------- */
    case "resetInputs":
      clearAgentPipeline();
      setStepperState(0, "", "");
      applyStepUI(0, {
        currentStep,
        stepperFill,
        stepperBox,
        readyBadge,
        stepLabel,
        stepInput,
      });
      resetUI();
      break;

    /* ----------------------------------------
        Mostrar respuesta dentro del chat
    ---------------------------------------- */
    case "chatResponse":
      hideLoadingUI();
      appendChatMessage("assistant", message.text);
      break;

    /* ----------------------------------------
        Avanzar al paso 2 (generación del test)
    ---------------------------------------- */
    case "goToStep2":
      setStepperState(2, undefined, undefined);
      applyStepUI(2, {
        currentStep,
        stepperFill,
        stepperBox,
        readyBadge,
        stepLabel,
        stepInput,
      });
      showLoadingUI();

      const { selectedModel, selectedSubModel } = getSelectedModel();
      vscode.postMessage({
        command: "generateTest",
        model: selectedModel,
        subModel: selectedSubModel,
      });
      break;
  }
});
