let selectedModel = null;
let selectedSubModel = null;

export function getSelectedModel() {
  return { selectedModel, selectedSubModel };
}

export function setModels(models, container, triggerId, vscode) {
  container.innerHTML = "";

  const otherModels = models.filter(m => m.id !== "openrouter");
  const openRouterModels = models.filter(m => m.id === "openrouter");
  const orderedModels = [...otherModels, ...openRouterModels];

  const dropdown = document.createElement("div");
  dropdown.className = "dropdown";

  const trigger = document.createElement("button");
  trigger.className = "dropbtn";
  trigger.id = triggerId;
  trigger.textContent = "Selecciona modelo";

  const dropdownContent = document.createElement("div");
  dropdownContent.className = "dropdown-content";

  orderedModels.forEach((m, index) => {
    if (m.id === "openrouter") {
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
    } else {
      const item = document.createElement("a");
      item.textContent = m.name;
      item.dataset.model = m.id;
      item.addEventListener("click", () => {
        selectedModel = m.id;
        selectedSubModel = null;
        trigger.textContent = m.name;
      });
      dropdownContent.appendChild(item);

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
      vscode.postMessage({
        command: "log",
        text: `Seleccionado: ${m.label} (${m.model})`,
      });
    });

    submenuContent.appendChild(subItem);

    if (i === 0 && selectedModel === null) {
      selectedModel = "openrouter";
      selectedSubModel = m.model;
      document.getElementById(triggerId).textContent = m.label;
    }
  });
}
