import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { ChatMessage } from "./sessionManager";
import type { LLMResult } from "./index";

export async function generateWithChatGPT(
  messages: ChatMessage[],
  model: string = "gpt-4o-mini"
): Promise<LLMResult> {
  const { text, usage } = await generateText({
    model: openai(model),
    messages,
  });
  return {
    text,
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    },
  };
}
