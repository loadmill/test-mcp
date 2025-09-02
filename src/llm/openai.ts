import OpenAI from "openai";
import { traceLLMRequest, traceLLMResponse, traceLLMError } from "../tracing.js";
import { LLM, Message, Response, LLMOptions, Tool, ToolCall, ToolResult } from "./types.js";

export class OpenAIAdapter implements LLM {
    constructor(private client: OpenAI, private model: string) {}

    private convertToOpenAIMessages(messages: Message[]): any[] {
        if (!messages) {return [];}

        return messages.map(msg => {
            if (typeof msg.content === "string") {
                return { role: msg.role, content: msg.content };
            }

            if (Array.isArray(msg.content)) {
                // Handle tool calls (assistant messages)
                if (msg.content.length > 0 && "name" in msg.content[0]) {
                    const toolCalls = msg.content as ToolCall[];
                    return {
                        role: "assistant",
                        tool_calls: toolCalls.map(tc => ({
                            id: tc.id,
                            type: "function",
                            function: {
                                name: tc.name,
                                arguments: JSON.stringify(tc.args)
                            }
                        }))
                    };
                }

                // Handle tool results (convert to multiple tool messages)
                const toolResults = msg.content as ToolResult[];
                return toolResults.map(tr => ({
                    role: "tool",
                    tool_call_id: tr.toolCallId,
                    content: tr.content
                }));
            }

            return { role: msg.role, content: String(msg.content) };
        }).flat().filter(msg => msg !== null); // Flatten and remove any null/undefined values
    }

    private convertToOpenAITools(tools: Tool[]): any[] {
        if (!tools) {return [];}

        return tools.map(tool => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema
            }
        }));
    }

    private convertFromOpenAIResponse(response: any): Response {
        const choice = response.choices[0];
        const message = choice.message;

        const textContent = message.content || "";
        const toolCalls: ToolCall[] = [];

        if (message.tool_calls) {
            for (const toolCall of message.tool_calls) {
                if (toolCall.type === "function") {
                    toolCalls.push({
                        id: toolCall.id,
                        name: toolCall.function.name,
                        args: JSON.parse(toolCall.function.arguments || "{}")
                    });
                }
            }
        }

        const stopReason = choice.finish_reason === "tool_calls" ? "tool_calls" :
            choice.finish_reason === "length" ? "max_tokens" :
                choice.finish_reason === "stop" ? "stop" : "other";

        return {
            textContent: textContent.trim(),
            toolCalls,
            stopReason
        };
    }

    async generate(messages: Message[], options: LLMOptions = {}): Promise<Response> {
        const { maxTokens = 1000, tools = [] } = options;

        const openaiMessages = this.convertToOpenAIMessages(messages);
        const openaiTools = this.convertToOpenAITools(tools);

        traceLLMRequest("openai", this.model, openaiMessages, openaiTools);

        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                max_tokens: maxTokens,
                messages: openaiMessages,
                tools: openaiTools.length > 0 ? openaiTools : undefined
            });

            traceLLMResponse("openai", this.model, response);
            return this.convertFromOpenAIResponse(response);
        } catch (error) {
            traceLLMError("openai", this.model, "generate", error);
            throw error;
        }
    }

    async evaluate(messages: Message[], prompt: string): Promise<string> {
        const evalMessages = [...messages, { role: "user" as const, content: prompt }];
        const openaiMessages = this.convertToOpenAIMessages(evalMessages);

        traceLLMRequest("openai", this.model, openaiMessages, []);

        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                max_tokens: 500,
                messages: openaiMessages
            });

            traceLLMResponse("openai", this.model, response);
            return response.choices[0].message.content || "";
        } catch (error) {
            traceLLMError("openai", this.model, "evaluate", error);
            throw error;
        }
    }
}
