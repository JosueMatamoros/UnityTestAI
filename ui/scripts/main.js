import { toggleElement, showLoading, switchToChat } from "./domUtils.js";
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
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");

hljs.highlightAll();
initJsonLoader();

// Avísale al backend que el DOM está listo
window.addEventListener("DOMContentLoaded", () => {
  vscode.postMessage({ command: "webviewReady" });
});

// Inicializa stepper
applyStepUI(0, {
  currentStep,
  stepperFill,
  stepperBox,
  readyBadge,
  stepLabel,
  stepInput,
});
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
    applyStepUI(1, {
      currentStep,
      stepperFill,
      stepperBox,
      readyBadge,
      stepLabel,
      stepInput,
    });
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

    // === Mostrar chat usando switchToChat ===
    const stepper = document.getElementById("stepper");
    const jsonContainer = document.getElementById("configLoader");
    const actionsContainer = document.getElementById("actions");
    const chatActionsContainer = document.getElementById("chatActions");

    switchToChat(
      stepper,
      jsonContainer,
      actionsContainer,
      chatActionsContainer
    );
  }

  if (message.command === "setModels") {
    setModels(
      message.models,
      document.getElementById("modelMenuContainer"),
      "modelBtn",
      vscode
    );
  }

  if (message.command === "setSubModels") {
    setSubModels(
      message.subModels,
      document.getElementById("openRouterSubmenu"),
      "modelBtn",
      vscode
    );
  }

  if (message.command === "requestInputs") {
    const pending = stepInput.value.trim();
    const state = getStepperState();
    if (state.step === 0 && pending)
      setStepperState(0, pending, state.methodNameVal);
    if (state.step === 1 && pending)
      setStepperState(1, state.classNameVal, pending);

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
  }

  if (message.command === "resetInputs") {
    setStepperState(0, "", "");
    applyStepUI(0, {
      currentStep,
      stepperFill,
      stepperBox,
      readyBadge,
      stepLabel,
      stepInput,
    });
    typingIndicator.style.display = "none";
    resultCard.style.display = "none";
  }

  if (message.command === "chatResponse") {
    typingIndicator.style.display = "none";
    appendChatMessage("assistant", message.text);
  }

  if (message.command === "goToStep2") {
    setStepperState(2, undefined, undefined);
    applyStepUI(2, {
      currentStep,
      stepperFill,
      stepperBox,
      readyBadge,
      stepLabel,
      stepInput,
    });

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

function appendChatMessage(role, text) {
  const container = resultContainer;

  // Crear wrapper principal
  const wrapper = document.createElement("div");
  wrapper.style.marginTop = "10px";

  if (role === "user") {
    // === Mensaje del usuario ===
    const msg = document.createElement("pre");
    msg.className = "chat-user";
    msg.style.whiteSpace = "pre-wrap";
    msg.style.padding = "8px";
    msg.style.borderRadius = "6px";
    msg.style.background =
      "var(--vscode-editorHoverWidget-background, #1e1e1e)";
    msg.textContent = text;
    wrapper.appendChild(msg);
  } else {
    // === Mensaje del modelo (Respuesta LLM con estilo del card) ===
    const card = document.createElement("div");
    card.className = "card llm-response";

    const header = document.createElement("div");
    header.className = "card-header";
    header.innerHTML = `
      <span>Resultado LLM</span>
      <button class="copy-btn">Copiar</button>
    `;
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "llm-body";

    // Aplicar highlight.js si es código
    if (text.includes("```")) {
      // Extraer lenguaje y código
      const match = text.match(/```(\w+)?\n([\s\S]*?)```/);
      if (match) {
        const lang = match[1] || "plaintext";
        const code = match[2];
        const pre = document.createElement("pre");
        const codeElem = document.createElement("code");
        codeElem.className = `language-${lang}`;
        codeElem.textContent = code.trim();
        pre.appendChild(codeElem);
        body.appendChild(pre);
        hljs.highlightElement(codeElem);
      } else {
        body.textContent = text;
      }
    } else {
      body.textContent = text;
    }

    card.appendChild(body);
    wrapper.appendChild(card);

    // === Botón copiar ===
    const copyBtn = header.querySelector(".copy-btn");
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copiado!";
      setTimeout(() => (copyBtn.textContent = "Copiar"), 1500);
    });
  }

  container.appendChild(wrapper);

  // === Scroll siempre al final ===
  container.scrollTo({
    top: container.scrollHeight,
    behavior: "smooth",
  });
}


if (chatInput && chatSendBtn) {
  chatSendBtn.addEventListener("click", () => {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = "";

    appendChatMessage("user", text);

    vscode.postMessage({
      command: "chatMessage",
      text,
    });

    typingIndicator.style.display = "flex";
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatSendBtn.click();
    }
  });
}
