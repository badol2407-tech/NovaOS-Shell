import OpenAI from "openai";
import type { AIProvider, ChatMessage } from "../types.js";
import { logger } from "../../logger.js";

// Live-verified free models (tested 2026-07-09). Provider tries each in order,
// skipping ones that return 404 (unavailable) or 429 (rate-limited upstream).
// Overridable by setting OPENROUTER_MODEL env var.
const FREE_MODEL_FALLBACKS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-20b:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-4-31b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
];

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

    const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      allMessages.push({ role: "system", content: systemPrompt });
    }
    for (const m of messages) {
      allMessages.push({ role: m.role, content: m.content });
    }

    // If user pinned a specific model, use it directly — no fallback.
    const pinnedModel = process.env["OPENROUTER_MODEL"];
    if (pinnedModel) {
      logger.debug({ provider: "openrouter", model: pinnedModel }, "Starting OpenRouter stream (pinned)");
      const stream = await client.chat.completions.create({
        model: pinnedModel,
        messages: allMessages,
        stream: true,
      });
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) yield content;
      }
      return;
    }

    // Try each free model in order; skip on 404 (removed) or 429 (rate-limited).
    let lastError: unknown;
    for (const model of FREE_MODEL_FALLBACKS) {
      try {
        logger.info({ provider: "openrouter", model }, "Trying OpenRouter model");
        const stream = await client.chat.completions.create({
          model,
          messages: allMessages,
          stream: true,
        });
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) yield content;
        }
        return; // success
      } catch (err: any) {
        const status = err?.status ?? err?.code;
        if (status === 404 || status === 429) {
          logger.warn(
            { provider: "openrouter", model, status, msg: err.message?.slice(0, 120) },
            "Model unavailable or rate-limited, trying next",
          );
          lastError = err;
          continue;
        }
        throw err; // other errors (auth, network, etc.) bubble up
      }
    }

    throw lastError ?? new Error("All OpenRouter free models unavailable or rate-limited");
  }
}
