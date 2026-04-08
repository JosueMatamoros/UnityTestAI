import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { ChatMessage } from "./sessionManager";

export async function generateWithChatGPT(
  messages: ChatMessage[],
  model: string = "gpt-4o-mini"
): Promise<string> {
  try {
    const { text } = await generateText({
      model: openai(model),
      messages,
    });
    return text;
  } catch (err: any) {
    return `Error al generar (ChatGPT): ${err.message || err}`;
  }
}
