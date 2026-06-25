export { generateWithChatGPT } from "./chatgpt";
export { generateWithOllama } from "./llamaLocal";
export { generateWithClaude } from "./claude";

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type LLMResult = {
  text: string;
  usage: TokenUsage;
};
