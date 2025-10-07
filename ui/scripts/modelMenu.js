/**
 * @file modelMenu.js
 * @description
 * Controla la generación dinámica del menú de selección de modelos LLM y sus submodelos.
 */

/**
 * Modelo seleccionado.
 * @type {string|null}
 */
let selectedModel = null;

/**
 * Submodelo seleccionado (si aplica).
 * @type {string|null}
 */
let selectedSubModel = null;

/**
 * Obtiene el modelo y submodelo seleccionados.
 * 
 * @returns {{ selectedModel: string|null, selectedSubModel: string|null }}
 * Objeto con los identificadores del modelo y submodelo activos.
 */
export function getSelectedModel() {
  return { selectedModel, selectedSubModel };
}

/**
 * Crea y renderiza el menú desplegable de modelos disponibles.
 * 
 * @param {Array<{ id: string, name: string }>} models - Lista de modelos disponibles.
 * @param {HTMLElement} container - Contenedor donde se renderizará el menú.
 * @param {string} triggerId - ID asignado al botón principal del menú.
 * @param {object} vscode - API de VS Code para comunicación con el backend.
 */
export function setModels(models, container, triggerId, vscode) {
  container.innerHTML = "";

  // Separar modelos normales de OpenRouter
  const otherModels = models.filter(m => m.id !== "openrouter");
  const openRouterModels = models.filter(m => m.id === "openrouter");
  const orderedModels = [...otherModels, ...openRouterModels];

  // Estructura base del menú desplegable
  const dropdown = document.createElement("div");
  dropdown.className = "dropdown";

  const trigger = document.createElement("button");
  trigger.className = "dropbtn";
  trigger.id = triggerId;
  trigger.textContent = "Selecciona modelo";

  const dropdownContent = document.createElement("div");
  dropdownContent.className = "dropdown-content";

  // Crear cada elemento del menú
  orderedModels.forEach((m, index) => {
    if (m.id === "openrouter") { // Caso especial: modelo OpenRouter con submodelos
      const submenu = document.createElement("div");
      submenu.className = "submenu";

      const submenuTitle = document.createElement("a");
      submenuTitle.className = "submenu-title";
      submenuTitle.textContent = "OpenRouter";

      const submenuContent = document.createElement("div");
      submenuContent.className = "submenu-content";
      submenuContent.id = "openRouterSubmenu";

      submenu.appendChild(submenuTitle);
      submenu.appendChild(submenuContent);
      dropdownContent.appendChild(submenu);
    } else {  // Modelos normales
      const item = document.createElement("a");
      item.textContent = m.name;
      item.dataset.model = m.id;

      item.addEventListener("click", () => {
        selectedModel = m.id;
        selectedSubModel = null;
        trigger.textContent = m.name;
      });

      dropdownContent.appendChild(item);

      // Seleccionar el primer modelo por defecto
      if (index === 0) {
        selectedModel = m.id;
        selectedSubModel = null;
        trigger.textContent = m.name;
      }
    }
  });

  dropdown.appendChild(trigger);
  dropdown.appendChild(dropdownContent);
  container.appendChild(dropdown);
}

/**
 * Genera y vincula los submodelos del modelo OpenRouter dentro del menú.
 * 
 * @param {Array<{ label: string, model: string }>} subModels - Lista de submodelos disponibles.
 * @param {HTMLElement} submenuContent - Contenedor donde se añadirán los submodelos.
 * @param {string} triggerId - ID del botón principal del menú (para actualizar el texto al seleccionar).
 * @param {object} vscode - API de VS Code para comunicación con el backend.
 */
export function setSubModels(subModels, submenuContent, triggerId, vscode) {
  submenuContent.innerHTML = "";

  subModels.forEach((m, i) => {
    const subItem = document.createElement("a");
    subItem.textContent = m.label;
    subItem.dataset.model = m.model;

    subItem.addEventListener("click", () => {
      selectedModel = "openrouter";
      selectedSubModel = m.model;
      document.getElementById(triggerId).textContent = m.label; 
    });

    submenuContent.appendChild(subItem);

    // Seleccionar primer submodelo por defecto si no hay otro modelo activo
    if (i === 0 && selectedModel === null) {
      selectedModel = "openrouter";
      selectedSubModel = m.model;
      document.getElementById(triggerId).textContent = m.label;
    }
  });
}
