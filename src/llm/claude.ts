import Anthropic from "@anthropic-ai/sdk";
import { ChatMessage } from "./sessionManager";
import type { LLMResult } from "./index";

// Lazily constructed so the client reads ANTHROPIC_API_KEY *after* extension.ts
// has run dotenv.config() — constructing at module load would race the env load
// and the SDK throws when the key is missing.
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/**
 * Generates a completion with Claude using the official Anthropic SDK.
 *
 * Mirrors the signature of generateWithChatGPT / generateWithOllama: it takes
 * the accumulated ChatMessage[] history and returns the assistant's text.
 *
 * Notes:
 *  - The Anthropic Messages API keeps the system prompt out of `messages`, so
 *    any `system` role messages are collapsed into the top-level `system` field.
 *  - Streaming is used because generated tests / JSON can be large and would
 *    otherwise risk SDK HTTP timeouts at high max_tokens.
 *  - Adaptive thinking is enabled; thinking blocks are ignored and only text
 *    blocks are returned (the agents downstream parse JSON/code from the text).
 */
export async function generateWithClaude(
  messages: ChatMessage[],
  model: string = "claude-opus-4-8"
): Promise<LLMResult> {
  const systemPrompt = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const conversation = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const stream = getClient().messages.stream({
    model,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: conversation,
  });

  const finalMessage = await stream.finalMessage();

  const text = finalMessage.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return {
    text,
    usage: {
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
    },
  };
}
