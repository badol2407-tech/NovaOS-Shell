export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StreamEvent {
  content?: string;
  provider?: string;
  error?: string;
  done?: boolean;
}

export interface AIProvider {
  readonly name: string;
  isAvailable(): boolean;
  streamChat(
    messages: ChatMessage[],
    systemPrompt?: string,
  ): AsyncGenerator<string>;
}
