import { Anthropic } from "@anthropic-ai/sdk";
import { MessageParam } from "@anthropic-ai/sdk/resources/messages/messages.mjs";

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
                return await client.messages.create({
                    model,
                    max_tokens: maxTokens,
                    messages,
                    tools,
                });
            },

            async evaluate(messages: MessageParam[], prompt: string) {
                const response = await client.messages.create({
                    model,
                    max_tokens: 500,
                    messages: [{ role: "user", content: prompt }],
                    tools: [],
                });

                return response.content
                    .filter(block => block.type === "text")
                    .map(block => block.text)
                    .join(" ");
            }
        };
    }

    default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
}
