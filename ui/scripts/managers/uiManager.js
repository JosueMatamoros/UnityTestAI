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


// === Pipeline de agentes ===

/**
 * Muestra o actualiza el estado de un agente en el pipeline.
 * status: "running" | "done" | "error"
 */
/**
 * @param {string} agentName
 * @param {"running"|"done"|"error"} status
 * @param {string} [model]   - model name shown while running
 * @param {string} [detail]  - extra info (file path, etc.)
 */
export function updateAgentStatus(agentName, status, detail) {
  const pipeline = document.getElementById("agentPipeline");
  if (!pipeline) return;

  pipeline.style.display = "block";

  let item = pipeline.querySelector(`[data-agent="${agentName}"]`);
  if (!item) {
    item = document.createElement("div");
    item.setAttribute("data-agent", agentName);
    pipeline.appendChild(item);
  }

  item.className = `agent-step agent-step--${status}`;

  if (status === "running") {
    item.innerHTML = `
      <span class="agent-step__name">${agentName}</span>
      <span class="agent-step__label">running</span>
      <span class="agent-step__dots"><span></span><span></span><span></span></span>
    `;
  } else if (status === "done") {
    item.innerHTML = `
      <span class="agent-step__name">${agentName}</span>
      <span class="agent-step__label">done</span>
    `;
  } else {
    item.innerHTML = `
      <span class="agent-step__name">${agentName}</span>
      <span class="agent-step__label">error${detail ? `: ${detail}` : ""}</span>
    `;
  }
}

/** Limpia el pipeline de agentes */
export function clearAgentPipeline() {
  const pipeline = document.getElementById("agentPipeline");
  if (pipeline) {
    pipeline.innerHTML = "";
    pipeline.style.display = "none";
  }
}

/**
 * Shows resolved dependency file paths as sub-items under the last agent step.
 * No title — just the file list appended directly.
 * @param {{ path: string, found: boolean }[]} files
 */
export function showDependencyFilesList(files) {
  const pipeline = document.getElementById("agentPipeline");
  if (!pipeline || !files.length) return;

  // Find the last agent step (Code Analyzer) and append under it
  const steps = pipeline.querySelectorAll(".agent-step");
  const lastStep = steps[steps.length - 1];
  if (!lastStep) return;

  const list = document.createElement("div");
  list.className = "agent-dep-files";

  for (const f of files) {
    const row = document.createElement("div");
    row.className = f.found
      ? "agent-dep-files__item agent-dep-files__item--found"
      : "agent-dep-files__item agent-dep-files__item--missing";
    row.textContent = `${f.found ? "\u2713" : "\u2717"} ${f.path}`;
    list.appendChild(row);
  }

  // Insert right after the last agent step
  lastStep.after(list);
}

/**
 * Shows the sliced dependency file paths under the Context Builder agent step.
 * @param {{ filePath: string }[]} slices
 */
export function showContextBuilderSlices(slices) {
  const pipeline = document.getElementById("agentPipeline");
  if (!pipeline || !slices.length) return;

  const ctxStep = pipeline.querySelector('[data-agent="Context Builder"]');
  if (!ctxStep) return;

  const list = document.createElement("div");
  list.className = "agent-dep-files";

  for (const s of slices) {
    const row = document.createElement("div");
    row.className = "agent-dep-files__item agent-dep-files__item--found";
    row.textContent = `✓ ${s.filePath}`;
    list.appendChild(row);
  }

  ctxStep.after(list);
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
