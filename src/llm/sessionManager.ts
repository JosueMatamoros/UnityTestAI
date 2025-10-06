// src/llm/sessionManager.ts
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class ChatSession {
  private messages: ChatMessage[] = [];

  constructor(systemPrompt?: string) {
    if (systemPrompt) {
      this.messages.push({ role: 'system', content: systemPrompt });
    }
  }

  addUserMessage(text: string) {
    this.messages.push({ role: 'user', content: text });
  }

  addAssistantMessage(text: string) {
    this.messages.push({ role: 'assistant', content: text });
  }

  getMessages() {
    return this.messages;
  }

  reset(systemPrompt?: string) {
    this.messages = [];
    if (systemPrompt) this.messages.push({ role: 'system', content: systemPrompt });
  }
}
