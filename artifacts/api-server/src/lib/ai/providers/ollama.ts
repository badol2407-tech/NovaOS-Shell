import OpenAI from "openai";
import type { AIProvider, ChatMessage } from "../types.js";
import { logger } from "../../logger.js";

export class OllamaProvider implements AIProvider {
  readonly name = "ollama";
  private client: OpenAI | null = null;

  isAvailable(): boolean {
    return Boolean(process.env["OLLAMA_BASE_URL"]);
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: "ollama",
        baseURL: process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434/v1",
      });
    }
    return this.client;
  }

  async *streamChat(
    messages: ChatMessage[],
    systemPrompt?: string,
  ): AsyncGenerator<string> {
    const client = this.getClient();
    const model = process.env["OLLAMA_MODEL"] ?? "llama3.2";

    const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      allMessages.push({ role: "system", content: systemPrompt });
    }
    for (const m of messages) {
      allMessages.push({ role: m.role, content: m.content });
    }

    logger.debug({ provider: "ollama", model }, "Starting Ollama stream");
    const stream = await client.chat.completions.create({
      model,
      messages: allMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }
}
