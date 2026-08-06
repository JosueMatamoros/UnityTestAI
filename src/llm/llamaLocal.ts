import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { ChatMessage } from "./sessionManager";
import type { LLMResult } from "./index";

const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: "http://localhost:11434/v1",
});

export async function generateWithOllama(
  messages: ChatMessage[],
  model: string = "qwen2.5:14b",
): Promise<LLMResult> {
  const { text, usage } = await generateText({
    model: ollama.chatModel(model),
    messages,
    temperature: 0,
    providerOptions: {
      ollama: { options: { num_ctx: 8192 } },
    },
  });
  return {
    text,
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    },
  };
}
