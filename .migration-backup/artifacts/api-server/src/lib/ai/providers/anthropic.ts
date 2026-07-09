import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, ChatMessage } from "../types.js";
import { logger } from "../../logger.js";

/**
 * Anthropic provider — uses claude-sonnet-4-5 by default.
 * Model is overridable via ANTHROPIC_MODEL env var.
 *
 * Requires: ANTHROPIC_API_KEY
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client: Anthropic | null = null;

  isAvailable(): boolean {
    return Boolean(process.env["ANTHROPIC_API_KEY"]);
  }

  private getClient(): Anthropic {
    if (!this.client) {
      const key = process.env["ANTHROPIC_API_KEY"];
      if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
      this.client = new Anthropic({ apiKey: key });
    }
    return this.client;
  }

  async *streamChat(
    messages: ChatMessage[],
    systemPrompt?: string,
  ): AsyncGenerator<string> {
    const client = this.getClient();
    const model = process.env["ANTHROPIC_MODEL"] ?? "claude-sonnet-4-5";

    // Anthropic only supports 'user' / 'assistant' roles in the messages
    // array — any inline 'system' role messages are dropped since the
    // top-level systemPrompt param covers that.
    const anthropicMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    logger.debug({ provider: "anthropic", model }, "Starting Anthropic stream");

    const stream = client.messages.stream({
      model,
      max_tokens: 8192,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: anthropicMessages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }
}
