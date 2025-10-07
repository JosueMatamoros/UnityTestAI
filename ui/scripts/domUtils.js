/**
 * @file domUtils.js
 * @description
 * Utilidades generales para manipular elementos del DOM.
 * Incluye funciones para mostrar, ocultar, alternar clases CSS y
 * gestionar estados visuales comunes como el modo de carga o el cambio a la vista de chat.
 */

/**
 * Alterna dinámicamente una clase CSS en un elemento.
 * 
 * @param {HTMLElement} el - Elemento del DOM sobre el que se aplica el cambio.
 * @param {string} [className="collapsed"] - Clase CSS a alternar.
 */
export function toggleElement(el, className = "collapsed") {
  if (!el) return;
  el.classList.toggle(className);
}

/**
 * Muestra un elemento estableciendo su propiedad `display`.
 * 
 * @param {HTMLElement} el - Elemento del DOM que se desea mostrar.
 */
export function show(el) {
  if (el) el.style.display = "";
}

/**
 * Oculta un elemento estableciendo su propiedad `display` a `"none"`.
 * 
 * @param {HTMLElement} el - Elemento del DOM que se desea ocultar.
 */
export function hide(el) {
  if (el) el.style.display = "none";
}

/**
 * Configura la interfaz mientras que el LLM retornoa una respuesta.
 * Muestra la tarjeta de resultados, el indicador de tipeo, y limpia el contenedor de resultados previo.
 * 
 * @param {HTMLElement} resultCard - Contenedor principal donde se mostrarán los resultados.
 * @param {HTMLElement} typingIndicator - Indicador visual del estado "Analizando".
 * @param {HTMLElement} [resultContainer] - Contenedor de texto o código.
 */
export function showLoading(resultCard, typingIndicator, resultContainer) {
  show(resultCard);
  show(typingIndicator, "flex");
  if (resultContainer) resultContainer.innerText = "";
}

/**
 * Cambia la interfaz al modo “Chat”.
 * Oculta los elementos del flujo previo (stepper, carga JSON, acciones) 
 * y muestra el contenedor de acciones del chat.
 * 
 * @param {HTMLElement} stepper - Contenedor del stepper de pasos.
 * @param {HTMLElement} jsonContainer - Contenedor de carga JSON.
 * @param {HTMLElement} actionsContainer - Contenedor de acciones.
 * @param {HTMLElement} chatActionsContainer - Contenedor de controles del chat. 
 */
export function switchToChat(stepper, jsonContainer, actionsContainer, chatActionsContainer) {
  hide(stepper);
  hide(jsonContainer);
  hide(actionsContainer);
  show(chatActionsContainer, "flex");
}
