// src/llm/gemini.ts
import { ChatMessage } from './sessionManager';

/**
 * Envía un historial de mensajes al modelo Gemini y devuelve la respuesta generada.
 *
 * @async
 * @function generateWithGeminiChat
 * @param {ChatMessage[]} messages - Lista de mensajes con `role` y `content`.
 * @returns {Promise<string>} Respuesta generada por el modelo o mensaje de error.
 * @throws {Error} Si la API responde con error o no hay resultado válido.
 */
export async function generateWithGeminiChat(messages: ChatMessage[]): Promise<string> {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": process.env.GEMINI_API_KEY || "",
        },
        body: JSON.stringify({
          contents: messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }],
          })),
        }),
      }
    );

    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data: any = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No hubo respuesta.";
  } catch (err: any) {
    return `Error al generar: ${err.message || err}`;
  }
}
