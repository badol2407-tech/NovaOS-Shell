import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProvider, ChatMessage } from "../types.js";
import { logger } from "../../logger.js";

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private client: GoogleGenerativeAI | null = null;

  isAvailable(): boolean {
    return Boolean(process.env["GEMINI_API_KEY"]);
  }

  private getClient(): GoogleGenerativeAI {
    if (!this.client) {
      const key = process.env["GEMINI_API_KEY"];
      if (!key) throw new Error("GEMINI_API_KEY not configured");
      this.client = new GoogleGenerativeAI(key);
    }
    return this.client;
  }

  async *streamChat(
    messages: ChatMessage[],
    systemPrompt?: string,
  ): AsyncGenerator<string> {
    const client = this.getClient();

    const model = client.getGenerativeModel({
      model: "gemini-2.0-flash",
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
    });

    // Gemini uses 'user' / 'model' roles only — filter system messages,
    // convert assistant → model, and ensure we alternate properly.
    const filteredHistory = messages
      .slice(0, -1)
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : ("user" as const),
        parts: [{ text: m.content }],
      }));

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;

    const chat = model.startChat({ history: filteredHistory });

    logger.debug({ provider: "gemini" }, "Starting Gemini stream");
    const result = await chat.sendMessageStream(lastMsg.content);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }
}
