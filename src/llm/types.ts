// Canonical LLM types - provider-neutral abstractions

export interface Message {
    role: 'user' | 'assistant';
    content: string | ToolCall[] | ToolResult[];
}

export interface ToolCall {
    id: string;
    name: string;
    args: Record<string, any>;
}

export interface ToolResult {
    toolCallId: string;
    content: string;
    isError?: boolean;
}

export interface Tool {
    name: string;
    description: string;
    inputSchema: Record<string, any>;
}

export interface Response {
    textContent: string;
    toolCalls: ToolCall[];
    stopReason: 'stop' | 'tool_calls' | 'max_tokens' | 'other';
}

export interface LLMOptions {
    maxTokens?: number;
    tools?: Tool[];
}

export interface LLM {
    generate(messages: Message[], options?: LLMOptions): Promise<Response>;
    evaluate(messages: Message[], prompt: string): Promise<string>;
}