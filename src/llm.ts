import { Anthropic } from "@anthropic-ai/sdk";
import { MessageParam } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { logger } from "./logger.js";

export interface LLM {
    generate(messages: MessageParam[], options?: { maxTokens?: number; tools?: any[] }): Promise<any>;
    evaluate(messages: MessageParam[], prompt: string): Promise<string>;
}

export function createLLM(config: { provider: string; model: string; apiKey: string }): LLM {
    const { provider, model, apiKey } = config;

    switch (provider.toLowerCase()) {
    case "anthropic": {
        const client = new Anthropic({ apiKey });

        return {
            async generate(messages: MessageParam[], options = {}) {
                const { maxTokens = 1000, tools = [] } = options;

                logger.llmRequest(provider, model, messages, tools);

                try {
                    const response = await client.messages.create({
                        model,
                        max_tokens: maxTokens,
                        messages,
                        tools,
                    });

                    logger.llmResponse(provider, model, response);

                    return response;
                } catch (error) {
                    logger.llmError(provider, model, "generate", error);
                    throw error;
                }
            },

            async evaluate(messages: MessageParam[], prompt: string) {
                const evalMessages = [{ role: "user" as const, content: prompt }];

                logger.llmRequest(provider, model, evalMessages, []);

                try {
                    const response = await client.messages.create({
                        model,
                        max_tokens: 500,
                        messages: evalMessages,
                        tools: [],
                    });

                    logger.llmResponse(provider, model, response);

                    return response.content
                        .filter(block => block.type === "text")
                        .map(block => block.text)
                        .join(" ");
                } catch (error) {
                    logger.llmError(provider, model, "evaluate", error);
                    throw error;
                }
            }
        };
    }

    default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
}
