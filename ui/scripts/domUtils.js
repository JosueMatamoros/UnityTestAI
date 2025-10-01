export function toggleElement(el, className = "collapsed") {
  if (!el) return;
  el.classList.toggle(className);
}

export function show(el) {
  if (el) el.style.display = "";
}

export function hide(el) {
  if (el) el.style.display = "none";
}

export function showLoading(resultCard, typingIndicator, resultContainer) {
  show(resultCard);
  show(typingIndicator, "flex");
  if (resultContainer) resultContainer.innerText = "";
}

export function switchToChat(stepper, jsonContainer, actionsContainer, chatActionsContainer) {
  hide(stepper);
  hide(jsonContainer);
  hide(actionsContainer);
  show(chatActionsContainer, "flex");
}
