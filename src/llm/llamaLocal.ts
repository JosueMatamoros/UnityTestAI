import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { ChatMessage } from "./sessionManager";

const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: "http://localhost:11434/v1",
});

export async function generateWithOllama(
  messages: ChatMessage[],
  model: string = "qwen2.5:14b"
): Promise<string> {
  const { text } = await generateText({
    model: ollama.chatModel(model),
    messages,
    temperature: 0,
    providerOptions: {
      ollama: { options: { num_ctx: 8192 } },
    },
  });
  return text;
}
