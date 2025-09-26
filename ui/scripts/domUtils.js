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
