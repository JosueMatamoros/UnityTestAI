import { show, hide } from "./domUtils.js";

let step = 0; // 0 = pedir clase, 1 = pedir método, 2 = listo
let classNameVal = "";
let methodNameVal = "";

export function getStepperState() {
  return { step, classNameVal, methodNameVal };
}

export function setStepperState(newStep, cls, method) {
  step = newStep;
  if (cls !== undefined) classNameVal = cls;
  if (method !== undefined) methodNameVal = method;
}

export function updateStepperUI(stepNum, { currentStep, stepperFill }) {
  if (currentStep) currentStep.textContent = stepNum;
  if (stepperFill) {
    stepperFill.style.width =
      stepNum === 0 ? "0%" : stepNum === 1 ? "50%" : "100%";
  }
}

export function applyStepUI(stepNum, { currentStep, stepperFill, stepperBox, readyBadge, stepLabel, stepInput }) {
  if (stepNum < 2) {
    show(stepperBox);
    hide(readyBadge);
    show(stepLabel);
    show(stepInput);

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
    hide(stepperBox);
    show(readyBadge);
    hide(stepLabel);
    hide(stepInput);
  }

  updateStepperUI(stepNum, { currentStep, stepperFill });
  stepInput.focus();
}
