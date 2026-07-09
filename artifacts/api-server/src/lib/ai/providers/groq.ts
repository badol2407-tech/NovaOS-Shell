import OpenAI from "openai";
import type { AIProvider, ChatMessage } from "../types.js";
import { logger } from "../../logger.js";

export class GroqProvider implements AIProvider {
  readonly name = "groq";
  private client: OpenAI | null = null;

  isAvailable(): boolean {
    return Boolean(process.env["GROQ_API_KEY"]);
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const key = process.env["GROQ_API_KEY"];
      if (!key) throw new Error("GROQ_API_KEY not configured");
      this.client = new OpenAI({
        apiKey: key,
        baseURL: "https://api.groq.com/openai/v1",
      });
    }
    return this.client;
  }

  async *streamChat(
    messages: ChatMessage[],
    systemPrompt?: string,
  ): AsyncGenerator<string> {
    const client = this.getClient();

    const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      allMessages.push({ role: "system", content: systemPrompt });
    }
    for (const m of messages) {
      allMessages.push({ role: m.role, content: m.content });
    }

    logger.debug({ provider: "groq" }, "Starting Groq stream");
    const stream = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: allMessages,
      stream: true,
      max_completion_tokens: 8192,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }
}
