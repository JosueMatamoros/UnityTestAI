// scripts/uiManager.js
import { show, hide } from "../domUtils.js";
import { switchToChat } from "../domUtils.js";

// === Referencias centralizadas ===
function getRefs() {
  return {
    resultCard: document.getElementById("resultCard"),
    typingIndicator: document.getElementById("typingIndicator"),
    resultContainer: document.getElementById("resultContainer"),
    stepper: document.getElementById("stepper"),
    jsonContainer: document.getElementById("configLoader"),
    actionsContainer: document.getElementById("actions"),
    chatActionsContainer: document.getElementById("chatActions"),
  };
}

// === Muestra el estado de carga principal (spinner del resultado) ===
export function showLoadingUI(clear = true) {
  const { resultCard, typingIndicator, resultContainer } = getRefs();
  show(resultCard);
  show(typingIndicator, "flex");
  if (clear && resultContainer) resultContainer.innerText = "";
}

// === Oculta el spinner global ===
export function hideLoadingUI() {
  const { typingIndicator } = getRefs();
  hide(typingIndicator);
}

// === Cambia a la vista de chat ===
export function showChatUI() {
  const { stepper, jsonContainer, actionsContainer, chatActionsContainer } =
    getRefs();
  switchToChat(stepper, jsonContainer, actionsContainer, chatActionsContainer);
}

// === Reinicia la vista (reset total) ===
export function resetUI() {
  const { resultCard, typingIndicator, resultContainer } = getRefs();
  hide(typingIndicator);
  hide(resultCard);
  if (resultContainer) resultContainer.innerText = "";
}


export function enterGenerationMode() {
  const stepper = document.getElementById("stepper");
  const jsonContainer = document.getElementById("configLoader");
  const actionsContainer = document.getElementById("actions");
  const resultCard = document.getElementById("resultCard");
  const typingIndicator = document.getElementById("typingIndicator");
  const resultContainer = document.getElementById("resultContainer");

  // Ocultar setup
  if (stepper) stepper.style.display = "none";
  if (jsonContainer) jsonContainer.style.display = "none";
  if (actionsContainer) actionsContainer.style.display = "none";

  // Mostrar loader
  if (resultCard) resultCard.style.display = "block";
  if (typingIndicator) typingIndicator.style.display = "flex";
  if (resultContainer) resultContainer.innerText = "";
}
