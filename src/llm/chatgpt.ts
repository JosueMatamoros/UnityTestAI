import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { ChatMessage } from "./sessionManager";

export async function generateWithChatGPT(
  messages: ChatMessage[],
  model: string = "gpt-4o-mini"
): Promise<string> {
  const { text } = await generateText({
    model: openai(model),
    messages,
  });
  return text;
}
