// scripts/chatManager.js
import { showLoadingUI, hideLoadingUI } from "./uiManager.js";

/**
 * Inicializa la lógica del chat (envío de mensajes, enter, scroll, etc.)
 */
export function initChat(vscode, chatInput, chatSendBtn) {
  if (!chatInput || !chatSendBtn) return;

  chatSendBtn.addEventListener("click", () => handleSend(vscode, chatInput));
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(vscode, chatInput);
    }
  });
}

/**
 * Maneja el envío de un mensaje de usuario
 */
function handleSend(vscode, chatInput) {
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = "";
  appendChatMessage("user", text);

  vscode.postMessage({ command: "chatMessage", text });

  // Spinner local del chat, no el global de resultCard
  showLoadingUI(false);
}

/**
 * Renderiza un nuevo mensaje en el contenedor de chat.
 * Incluye la lógica para mostrar y eliminar el indicador "Analizando".
 */
export function appendChatMessage(role, text) {
  const container = document.getElementById("chatContainer");
  const wrapper = document.createElement("div");
  wrapper.style.marginTop = "10px";

  // --- Mensaje del usuario ---
  if (role === "user") {
    const msg = document.createElement("pre");
    msg.className = "chat-user";
    msg.textContent = text;
    wrapper.appendChild(msg);

    // Indicador local "Analizando"
    const typing = document.createElement("div");
    typing.className = "typing-indicator";
    typing.innerHTML = `
      <span>Analizando</span>
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    `;
    wrapper.appendChild(typing);
  }

  // --- Respuesta del asistente ---
  else if (role === "assistant") {
    // Eliminar el último "Analizando" del chat
    const lastTyping = container.querySelector(".typing-indicator");
    if (lastTyping) lastTyping.remove();

    const card = document.createElement("div");
    card.className = "llm-response";

    const header = document.createElement("div");
    header.className = "card-header";
    header.innerHTML = `
      <span>Resultado LLM</span>
      <button class="copy-btn">Copiar</button>
    `;
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "llm-body";

    // Detección de bloque de código
    const codeBlock = text.match(/```(\w+)?\n([\s\S]*?)```/);
    if (codeBlock) {
      const lang = codeBlock[1] || "plaintext";
      const code = codeBlock[2];
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

    card.appendChild(body);
    wrapper.appendChild(card);

    // Botón copiar
    const copyBtn = header.querySelector(".copy-btn");
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copiado!";
      setTimeout(() => (copyBtn.textContent = "Copiar"), 1500);
    });

    // Ocultar spinner global, si estaba activo
    hideLoadingUI();
  }

  container.appendChild(wrapper);
  container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
}
