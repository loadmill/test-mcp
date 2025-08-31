import { Anthropic } from "@anthropic-ai/sdk";
import { traceLLMRequest, traceLLMResponse, traceLLMError } from "../tracing.js";
import { LLM, Message, Response, LLMOptions, Tool, ToolCall, ToolResult } from "./types.js";

export class AnthropicAdapter implements LLM {
    constructor(private client: Anthropic, private model: string) {}

    private convertToAnthropicMessages(messages: Message[]): any[] {
        if (!messages) return [];
        
        return messages.map(msg => {
            if (typeof msg.content === 'string') {
                return { role: msg.role, content: msg.content };
            }
            
            if (Array.isArray(msg.content)) {
                // Handle tool calls (assistant messages with tool calls)
                if (msg.content.length > 0 && 'name' in msg.content[0]) {
                    const toolCalls = msg.content as ToolCall[];
                    return {
                        role: msg.role,
                        content: toolCalls.map(tc => ({
                            type: 'tool_use',
                            id: tc.id,
                            name: tc.name,
                            input: tc.args
                        }))
                    };
                }
                
                // Handle tool results (user messages with tool results)
                const toolResults = msg.content as ToolResult[];
                return {
                    role: msg.role,
                    content: toolResults.map(tr => ({
                        type: 'tool_result',
                        tool_use_id: tr.toolCallId,
                        content: tr.content,
                        is_error: tr.isError || false
                    }))
                };
            }
            
            return { role: msg.role, content: String(msg.content) };
        });
    }

    private convertToAnthropicTools(tools: Tool[]): any[] {
        if (!tools) return [];
        
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema
        }));
    }

    private convertFromAnthropicResponse(response: any): Response {
        let textContent = '';
        const toolCalls: ToolCall[] = [];

        for (const block of response.content || []) {
            if (block.type === 'text') {
                textContent += block.text;
            } else if (block.type === 'tool_use') {
                toolCalls.push({
                    id: block.id,
                    name: block.name,
                    args: block.input || {}
                });
            }
        }

        const stopReason = response.stop_reason === 'tool_use' ? 'tool_calls' :
                          response.stop_reason === 'max_tokens' ? 'max_tokens' :
                          response.stop_reason === 'end_turn' ? 'stop' : 'other';

        return {
            textContent: textContent.trim(),
            toolCalls,
            stopReason
        };
    }

    async generate(messages: Message[], options: LLMOptions = {}): Promise<Response> {
        const { maxTokens = 1000, tools = [] } = options;
        
        const anthropicMessages = this.convertToAnthropicMessages(messages);
        const anthropicTools = this.convertToAnthropicTools(tools);

        traceLLMRequest('anthropic', this.model, anthropicMessages, anthropicTools);

        try {
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: maxTokens,
                messages: anthropicMessages,
                tools: anthropicTools
            });

            traceLLMResponse('anthropic', this.model, response);
            return this.convertFromAnthropicResponse(response);
        } catch (error) {
            traceLLMError('anthropic', this.model, 'generate', error);
            throw error;
        }
    }

    async evaluate(messages: Message[], prompt: string): Promise<string> {
        const evalMessages = [...messages, { role: 'user' as const, content: prompt }];
        const anthropicMessages = this.convertToAnthropicMessages(evalMessages);

        traceLLMRequest('anthropic', this.model, anthropicMessages, []);

        try {
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 500,
                messages: anthropicMessages,
                tools: []
            });

            traceLLMResponse('anthropic', this.model, response);

            return response.content
                .filter((block: any) => block.type === "text")
                .map((block: any) => block.text)
                .join(" ");
        } catch (error) {
            traceLLMError('anthropic', this.model, 'evaluate', error);
            throw error;
        }
    }
}