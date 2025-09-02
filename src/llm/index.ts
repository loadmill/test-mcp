import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { AnthropicAdapter } from "./anthropic.js";
import { OpenAIAdapter } from "./openai.js";
import { LLM } from "./types.js";

// Re-export all types from the canonical location
export * from "./types.js";

export function createLLM(config: { provider: string; model: string; apiKey: string }): LLM {
    const { provider, model, apiKey } = config;

    if (!apiKey) {
        throw new Error(`API key is required for provider: ${provider}`);
    }

    switch (provider.toLowerCase()) {
    case "anthropic":
        return new AnthropicAdapter(new Anthropic({ apiKey }), model);

    case "openai":
        return new OpenAIAdapter(new OpenAI({ apiKey }), model);

    default:
        throw new Error(`Unsupported LLM provider: ${provider}. Supported providers: anthropic, openai`);
    }
}
