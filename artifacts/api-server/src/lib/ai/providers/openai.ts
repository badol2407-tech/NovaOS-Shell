/**
 * OpenAI provider — uses gpt-4o-mini by default.
 * Model is overridable via OPENAI_MODEL env var.
 *
 * Requires: OPENAI_API_KEY
 */

import OpenAI from "openai";
import type { AIProvider, ChatMessage } from "../types.js";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  isAvailable(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async *streamChat(
    messages: ChatMessage[],
    systemPrompt?: string,
  ): AsyncGenerator<string> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      openaiMessages.push({ role: "system", content: systemPrompt });
    }
    for (const msg of messages) {
      openaiMessages.push({ role: msg.role, content: msg.content });
    }

    const stream = await client.chat.completions.create({
      model,
      messages: openaiMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}
