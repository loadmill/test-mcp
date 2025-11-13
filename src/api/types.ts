/**
 * Public API types for test-mcp programmatic usage
 */

// LLM Configuration
export interface LLMConfig {
    provider: 'anthropic' | 'openai';
    model: string;
    apiKey: string;
    maxTokens?: number;
}

// Server Configurations
export interface StdioServerConfig {
    type: 'stdio';
    command: string;
    args: string[];
    env?: Record<string, string>;
}

export interface HttpServerConfig {
    type: 'http';
    url: string;
    headers?: Record<string, string>;
}

export type ServerConfig = StdioServerConfig | HttpServerConfig;

// Client Options
export interface ClientOptions {
    clientName?: string;
    clientVersion?: string;
    trace?: boolean;
}

// Main Configuration
export interface TestMCPClientConfig {
    llm: LLMConfig;
    servers: Record<string, ServerConfig>;
    options?: ClientOptions;
}

// Response Types
export interface ToolExecution {
    serverName: string;
    toolName: string;
    originalToolName: string;
    result?: string;
}

export interface PromptResponse {
    text: string;
    toolCalls: ToolExecution[];
    messages: any[]; // Conversation messages
}

export interface AssertionResult {
    passed: boolean;
    reasoning: string;
}
