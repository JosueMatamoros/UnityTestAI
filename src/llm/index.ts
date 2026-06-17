export { generateWithChatGPT } from "./chatgpt";
export { generateWithOllama } from "./llamaLocal";
export { generateWithClaude } from "./claude";

/** Conteo de tokens normalizado entre proveedores (Claude, OpenAI, Ollama). */
export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

/** Respuesta de cualquier `generateWith*`: texto + uso de tokens reportado por la API. */
export type LLMResult = {
  text: string;
  usage: TokenUsage;
};
