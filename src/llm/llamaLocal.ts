import { ChatMessage } from "./sessionManager";

/**
 * Envía un historial de mensajes a un modelo LLaMA local vía Ollama
 * y devuelve la respuesta generada.
 *
 * @async
 * @function generateWithLocalLlamaChat
 * @param {ChatMessage[]} messages - Lista de mensajes con role y content.
 * @param {string} model - Nombre del modelo (por defecto llama3).
 * @returns {Promise<string>} Respuesta generada o mensaje de error.
 */
export async function generateWithLocalLlamaChat(
  messages: ChatMessage[],
  model: string = "llama3"
): Promise<string> {
  try {
    const response = await fetch("http://localhost:11434/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role:
            m.role === "user"
              ? "user"
              : m.role === "assistant"
              ? "assistant"
              : "system",
          content: m.content,
        })),
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    return data.choices?.[0]?.message?.content ?? "No hubo respuesta.";
  } catch (err: any) {
    return `Error al generar: ${err.message || err}`;
  }
}
