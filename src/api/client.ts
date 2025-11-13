import { MCPClient } from '../mcp-client.js';
import { createLLM } from '../llm/index.js';
import { initializeTracing } from '../tracing.js';
import { ResolvedMCPConfig } from '../config-types.js';
import type {
    TestMCPClientConfig,
    PromptResponse,
    AssertionResult,
} from './types.js';

/**
 * TestMCPClient - Programmatic API for test-mcp headless client
 *
 * Example usage:
 * ```javascript
 * const client = new TestMCPClient({
 *   llm: {
 *     provider: 'anthropic',
 *     model: 'claude-3-5-haiku-latest',
 *     apiKey: process.env.ANTHROPIC_API_KEY
 *   },
 *   servers: {
 *     myServer: {
 *       type: 'stdio',
 *       command: 'node',
 *       args: ['./server.js']
 *     }
 *   }
 * });
 *
 * await client.connect();
 * const response = await client.prompt('Roll the dice');
 * console.log(response.text);
 * await client.disconnect();
 * ```
 */
export class TestMCPClient {
    private config: TestMCPClientConfig;
    private mcpClient: MCPClient | null = null;
    private connected: boolean = false;

    constructor(config: TestMCPClientConfig) {
        this.config = config;
    }

    /**
     * Connect to all configured MCP servers
     * Must be called before using prompt() or assert()
     */
    async connect(): Promise<void> {
        if (this.connected) {
            throw new Error('Client is already connected. Call disconnect() first if you need to reconnect.');
        }

        // Initialize tracing (always needed, but only writes to file if enabled)
        if (this.config.options?.trace) {
            process.env.TRACE = 'true';
        }
        initializeTracing();

        // Create LLM instance
        const llm = createLLM({
            provider: this.config.llm.provider,
            model: this.config.llm.model,
            apiKey: this.config.llm.apiKey,
        });

        // Create MCP client
        this.mcpClient = new MCPClient(llm, {
            maxTokens: this.config.llm.maxTokens || 1000,
            clientName: this.config.options?.clientName || 'test-mcp-client',
            clientVersion: this.config.options?.clientVersion || '1.0.0',
        });

        // Connect to all servers
        const resolvedConfig = this.convertToResolvedConfig();
        await this.mcpClient.connectToServers(resolvedConfig.mcpServers);

        this.connected = true;
    }

    /**
     * Execute a prompt and get detailed response with tool calls
     *
     * @param query - The prompt/query to send
     * @returns Response with text, tool calls, and conversation messages
     */
    async prompt(query: string): Promise<PromptResponse> {
        this.ensureConnected();

        const result = await this.mcpClient!.processQueryWithDetails(query);

        return {
            text: result.response,
            toolCalls: result.toolExecutions,
            messages: this.mcpClient!.getMessageSnapshot(),
        };
    }

    /**
     * Evaluate an assertion against the conversation history and tool executions
     *
     * @param assertion - Natural language assertion to evaluate
     * @returns Result with passed boolean and reasoning
     */
    async assert(assertion: string): Promise<AssertionResult> {
        this.ensureConnected();

        return await this.mcpClient!.evaluateAssertion(assertion);
    }

    /**
     * Clear conversation history and tool execution log
     * Useful for starting a fresh test scenario
     */
    clearHistory(): void {
        this.ensureConnected();
        this.mcpClient!.clearConversationHistory();
    }

    /**
     * Disconnect from all MCP servers and cleanup resources
     */
    async disconnect(): Promise<void> {
        if (!this.connected || !this.mcpClient) {
            return;
        }

        await this.mcpClient.cleanup();
        this.mcpClient = null;
        this.connected = false;
    }

    /**
     * Get current conversation message history
     * Useful for debugging or logging
     */
    getMessages(): any[] {
        this.ensureConnected();
        return this.mcpClient!.getMessageSnapshot();
    }

    // Private helper methods

    private ensureConnected(): void {
        if (!this.connected || !this.mcpClient) {
            throw new Error('Client is not connected. Call connect() first.');
        }
    }

    private convertToResolvedConfig(): ResolvedMCPConfig {
        return {
            mcpClient: {
                provider: this.config.llm.provider,
                model: this.config.llm.model,
                apiKey: this.config.llm.apiKey,
            },
            mcpServers: this.config.servers as ResolvedMCPConfig['mcpServers'],
        };
    }
}
