import OpenAI from "openai";
import type { AIProvider, ChatMessage } from "../types.js";
import { logger } from "../../logger.js";

// Default free model — overridable via OPENROUTER_MODEL env var.
const DEFAULT_MODEL = "meta-llama/llama-3.1-8b-instruct:free";

export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";
  private client: OpenAI | null = null;

  isAvailable(): boolean {
    return Boolean(process.env["OPENROUTER_API_KEY"]);
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const key = process.env["OPENROUTER_API_KEY"];
      if (!key) throw new Error("OPENROUTER_API_KEY not configured");
      this.client = new OpenAI({
        apiKey: key,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "https://novaos.app",
          "X-Title": "NovaOS",
        },
      });
    }
    return this.client;
  }

  async *streamChat(
    messages: ChatMessage[],
    systemPrompt?: string,
  ): AsyncGenerator<string> {
    const client = this.getClient();
    const model = process.env["OPENROUTER_MODEL"] ?? DEFAULT_MODEL;

    const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      allMessages.push({ role: "system", content: systemPrompt });
    }
    for (const m of messages) {
      allMessages.push({ role: m.role, content: m.content });
    }

    logger.debug({ provider: "openrouter", model }, "Starting OpenRouter stream");
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
