/**
 * @file stepper.js
 * @description
 * Controla la lógica y visualización del "stepper" en la UI.
 * Permite avanzar entre los pasos de ingreso de datos,
 * actualizar los valores internos y sincronizar los cambios en la interfaz.
 */

import { show, hide } from "./domUtils.js";

/**
 * Estado interno del stepper:
 * - step = 0: pedir nombre de la clase
 * - step = 1: pedir nombre del método
 * - step = 2: proceso listo
 * 
 * @type {number}
 */
let step = 0;

/**
 * Nombre de la clase ingresado por el usuario.
 * @type {string}
 */
let classNameVal = "";

/**
 * Nombre del método ingresado por el usuario.
 * @type {string}
 */
let methodNameVal = "";

/**
 * Obtiene el estado actual del stepper.
 * 
 * @returns {{ step: number, classNameVal: string, methodNameVal: string }}
 * Objeto con el paso actual y los valores capturados de clase y método.
 */
export function getStepperState() {
  return { step, classNameVal, methodNameVal };
}

/**
 * Actualiza el estado del stepper con nuevos valores.
 * 
 * @param {number} newStep - Paso actual.
 * @param {string} [cls] - Nombre de la clase.
 * @param {string} [method] - Nombre del método.
 */
export function setStepperState(newStep, cls, method) {
  step = newStep;
  if (cls !== undefined) classNameVal = cls;
  if (method !== undefined) methodNameVal = method;
}

/**
 * Actualiza los elementos visuales del stepper según el paso actual.
 * 
 * @param {number} stepNum - Número del paso actual.
 * @param {{ currentStep: HTMLElement, stepperFill: HTMLElement }} param1
 * Elementos del DOM asociados al texto y barra de progreso.
 */
export function updateStepperUI(stepNum, { currentStep, stepperFill }) {
  if (currentStep) currentStep.textContent = stepNum;
  if (stepperFill) {
    stepperFill.style.width =
      stepNum === 0 ? "0%" : stepNum === 1 ? "50%" : "100%";
  }
}

/**
 * Aplica los cambios de UI correspondientes al paso actual.
 * 
 * @param {number} stepNum - Número del paso actual.
 * @param {{
 *   currentStep: HTMLElement,
 *   stepperFill: HTMLElement,
 *   stepperBox: HTMLElement,
 *   readyBadge: HTMLElement,
 *   stepLabel: HTMLElement,
 *   stepInput: HTMLInputElement
 * }} elements - Conjunto de elementos DOM usados en el stepper.
 */
export function applyStepUI(
  stepNum,
  { currentStep, stepperFill, stepperBox, readyBadge, stepLabel, stepInput }
) {
  if (stepNum < 2) {
    // Mostrar controles de entrada
    show(stepperBox);
    hide(readyBadge);
    show(stepLabel);
    show(stepInput);

    // Configurar etiquetas y placeholders según el paso
    if (stepNum === 0) {
      stepLabel.textContent = "Nombre de la clase";
      stepInput.placeholder = "Utilities";
      stepInput.value = classNameVal;
    } else {
      stepLabel.textContent = "Nombre del método";
      stepInput.placeholder = "CheckHorizontal1";
      stepInput.value = methodNameVal;
    }
  } else {
    // Paso final: ocultar el stepper y mostrar badge
    hide(stepperBox);
    show(readyBadge);
    hide(stepLabel);
    hide(stepInput);
  }

  // Actualizar indicador visual y enfocar input
  updateStepperUI(stepNum, { currentStep, stepperFill });
  stepInput.focus();
}
