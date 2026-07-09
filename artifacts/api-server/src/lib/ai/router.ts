/**
 * AI Provider Router — tries providers in priority order with fallback.
 *
 * Priority: Gemini (primary) → Groq (secondary) → OpenRouter (fallback) → Ollama (local)
 *
 * All providers are read from environment variables only — no hardcoded keys.
 *
 * Fallback semantics: once any chunk has been emitted to the caller, we do NOT
 * fall through to the next provider. Mixing output from two providers in a single
 * SSE session would produce incoherent responses and incorrect provenance tracking.
 * Fallback only happens *before* the first chunk is yielded.
 */

import { logger } from "../logger.js";
import type { AIProvider, ChatMessage, StreamEvent } from "./types.js";
import { GeminiProvider } from "./providers/gemini.js";
import { OpenAIProvider } from "./providers/openai.js";
import { GroqProvider } from "./providers/groq.js";
import { OpenRouterProvider } from "./providers/openrouter.js";
import { OllamaProvider } from "./providers/ollama.js";

// Priority: Gemini → OpenAI → Groq → OpenRouter → Ollama
// All providers are keyed from environment variables only.
const PROVIDERS: AIProvider[] = [
  new GeminiProvider(),
  new OpenAIProvider(),
  new GroqProvider(),
  new OpenRouterProvider(),
  new OllamaProvider(),
];

export function getProviderStatus(): { name: string; available: boolean }[] {
  return PROVIDERS.map((p) => ({ name: p.name, available: p.isAvailable() }));
}

/**
 * Streams an AI response with automatic provider fallback.
 * Yields StreamEvent objects — callers write these to SSE.
 *
 * IMPORTANT: once the first `content` chunk is yielded, this generator will
 * NOT fall back to another provider even if the current one later throws.
 * Instead it emits a `{ error }` event so the client knows the stream broke.
 */
export async function* streamWithFallback(
  messages: ChatMessage[],
  systemPrompt?: string,
): AsyncGenerator<StreamEvent> {
  const available = PROVIDERS.filter((p) => p.isAvailable());

  if (available.length === 0) {
    yield {
      error:
        "No AI providers are configured. Set GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, or OLLAMA_BASE_URL.",
    };
    yield { done: true };
    return;
  }

  for (const provider of available) {
    let chunksEmitted = 0;
    try {
      logger.info({ provider: provider.name }, "Trying AI provider");

      for await (const chunk of provider.streamChat(messages, systemPrompt)) {
        chunksEmitted++;
        yield { content: chunk };
      }

      yield { done: true, provider: provider.name };
      return;
    } catch (err) {
      if (chunksEmitted > 0) {
        // Partial content already streamed — cannot fall back safely.
        // Emit a terminal error event so the client knows the stream broke.
        logger.error(
          { err, provider: provider.name, chunksEmitted },
          "AI provider failed mid-stream — cannot fall back after chunks emitted",
        );
        yield { error: "Stream interrupted — provider failed mid-response" };
        yield { done: true, provider: provider.name };
        return;
      }
      logger.warn(
        { err, provider: provider.name },
        "AI provider failed before first chunk — trying next provider",
      );
      // Continue to the next provider
    }
  }

  yield {
    error:
      "All AI providers failed. Please check your API keys and network connectivity.",
  };
  yield { done: true };
}

/**
 * Non-streaming version for use in the terminal `nova` command.
 * Collects the full response and returns it with the provider name.
 */
export async function askOnce(
  messages: ChatMessage[],
  systemPrompt?: string,
): Promise<{ response: string; provider: string }> {
  const available = PROVIDERS.filter((p) => p.isAvailable());

  if (available.length === 0) {
    throw new Error(
      "No AI providers configured. Set GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, or OLLAMA_BASE_URL.",
    );
  }

  for (const provider of available) {
    try {
      let response = "";
      for await (const chunk of provider.streamChat(messages, systemPrompt)) {
        response += chunk;
      }
      return { response, provider: provider.name };
    } catch (err) {
      logger.warn(
        { err, provider: provider.name },
        "AI provider failed for askOnce — trying next",
      );
    }
  }

  throw new Error("All AI providers failed.");
}
