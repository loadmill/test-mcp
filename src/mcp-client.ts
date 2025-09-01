import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { LLM, Message, Tool, ToolCall, ToolResult, Response } from "./llm/index.js";
import { traceMCPToolCall, traceMCPToolResult, traceMCPError } from "./tracing.js";
import { ResolvedMCPConfig } from "./config-types.js";

// message history for the whole run - now using canonical format
const messages: Message[] = [];

export interface MCPClientOptions {
    maxTokens: number;
    clientName: string;
    clientVersion: string;
}

interface ServerConnection {
    client: Client;
    transport: StdioClientTransport | StreamableHTTPClientTransport;
    name: string;
    type: "stdio" | "http";
}

type ServerConfig = ResolvedMCPConfig["mcpServers"][string];

interface ToolRegistration {
    serverName: string;
    originalToolName: string;
}

interface ToolExecution {
    serverName: string;
    toolName: string;
    originalToolName: string;
    result?: string; // Tool result for assertion evaluation
}

interface QueryResult {
    response: string;
    toolExecutions: ToolExecution[];
}

export class MCPClient {
    private servers: ServerConnection[] = [];
    private llm: LLM;
    private tools: Tool[] = [];
    private toolRegistry: Map<string, ToolRegistration> = new Map(); // namespacedToolName -> {serverName, originalToolName}
    private options: MCPClientOptions;
    private allToolExecutions: ToolExecution[] = []; // Track all tool executions for the session
    
    constructor(llm: LLM, options: MCPClientOptions) {
        this.llm = llm;
        this.options = options;
    }

    async connectToServer(serverName: string, config: ServerConfig) {
        try {
            const { client, transport, type } = await this.setupServerConnection(serverName, config);
            const serverTools = await this.registerServerTools(serverName, client);
            
            this.servers.push({ client, transport, name: serverName, type });
            this.tools.push(...serverTools);
            
            console.log(`Connected to server '${serverName}' (${type}) with tools:`, serverTools.map(t => t.name));
        } catch (e) {
            console.error(`Failed to connect to MCP server '${serverName}':`, e);
            throw e;
        }
    }

    private async setupServerConnection(serverName: string, config: ServerConfig) {
        let transport: StdioClientTransport | StreamableHTTPClientTransport;
        let transportType: "stdio" | "http";
        
        if (config.type === "stdio") {
            transport = new StdioClientTransport({
                command: config.command,
                args: config.args,
                env: config.env
            });
            transportType = "stdio";
        } else if (config.type === "http") {
            const url = new URL(config.url);
            const requestInit: RequestInit = {};
            
            if (config.headers) {
                requestInit.headers = config.headers;
            }
            
            transport = new StreamableHTTPClientTransport(url, {
                requestInit
            });
            transportType = "http";
        } else {
            throw new Error(`Unknown transport type for server '${serverName}': ${(config as any).type || "missing type field"}`);
        }
        
        const client = new Client({
            name: `${this.options.clientName}-${serverName}`,
            version: this.options.clientVersion
        });

        await client.connect(transport);
        
        return { client, transport, type: transportType };
    }

    private async registerServerTools(serverName: string, client: Client): Promise<Tool[]> {
        const toolsResult = await client.listTools();
        
        const serverTools: Tool[] = toolsResult.tools.map(tool => {
            const namespacedName = `${serverName}_${tool.name}`;
            return {
                name: namespacedName, // Use namespaced name for LLM
                description: tool.description || `Tool: ${tool.name}`,
                inputSchema: tool.inputSchema,
            };
        });

        // Register each tool with its namespaced name and original details
        for (const originalTool of toolsResult.tools) {
            const namespacedName = `${serverName}_${originalTool.name}`;
            this.toolRegistry.set(namespacedName, {
                serverName: serverName,
                originalToolName: originalTool.name
            });
        }

        return serverTools;
    }

    async connectToServers(servers: { [name: string]: ServerConfig }) {
        for (const [name, config] of Object.entries(servers)) {
            await this.connectToServer(name, config);
        }
        console.log("All servers connected. Total tools:", this.tools.map(t => t.name));
    }

    async processQuery(query: string): Promise<string> {
        const result = await this.processQueryWithDetails(query);
        return result.response;
    }

    async processQueryWithDetails(query: string): Promise<QueryResult> {
        const toolExecutions: ToolExecution[] = [];
        
        // Add user message to conversation history
        messages.push({ role: "user", content: query });

        let response = await this.llm.generate(messages, {
            maxTokens: this.options.maxTokens,
            tools: this.tools
        });

        // Process any tool calls
        if (response.toolCalls.length > 0) {
            const toolResults = await this.executeToolCalls(response.toolCalls, toolExecutions);
            response = await this.generateFinalResponse(toolResults);
        }

        // Add final assistant response to history
        if (response.textContent || response.toolCalls.length === 0) {
            messages.push({ 
                role: "assistant", 
                content: response.textContent 
            });
        }

        return {
            response: response.textContent,
            toolExecutions
        };
    }

    private async executeToolCalls(toolCalls: ToolCall[], toolExecutions?: ToolExecution[]): Promise<ToolResult[]> {
        // Add assistant message with tool calls to history
        messages.push({ 
            role: "assistant", 
            content: toolCalls 
        });

        const toolResults: ToolResult[] = [];

        for (const toolCall of toolCalls) {
            const { result, execution } = await this.executeSingleTool(toolCall);
            toolResults.push(result);
            
            if (toolExecutions && execution) {
                toolExecutions.push(execution);
            }
            if (execution) {
                this.allToolExecutions.push(execution);
            }
        }

        // Add tool results to message history
        messages.push({ role: "user", content: toolResults });

        return toolResults;
    }

    private async executeSingleTool(toolCall: ToolCall): Promise<{ result: ToolResult; execution: ToolExecution | null }> {
        const { name, args, id } = toolCall;

        // Look up which server has this namespaced tool
        const toolRegistration = this.toolRegistry.get(name);
        if (!toolRegistration) {
            throw new Error(`Tool '${name}' not found on any connected server`);
        }

        const server = this.servers.find(s => s.name === toolRegistration.serverName);
        if (!server) {
            throw new Error(`Server '${toolRegistration.serverName}' for tool '${name}' is not connected`);
        }

        const execution: ToolExecution = {
            serverName: server.name,
            toolName: name,
            originalToolName: toolRegistration.originalToolName
        };

        traceMCPToolCall(server.name, name, toolRegistration.originalToolName, args, server.type);
        
        try {
            // Call the tool using its original name on the server
            const mcpResult = await server.client.callTool({ 
                name: toolRegistration.originalToolName, 
                arguments: args 
            });
            
            traceMCPToolResult(server.name, name, toolRegistration.originalToolName, mcpResult, server.type);

            // Convert MCP result to text
            const textOut = Array.isArray(mcpResult.content)
                ? mcpResult.content
                    .map((c: any) => (c?.type === "text" ? c.text : typeof c === "string" ? c : ""))
                    .filter(Boolean)
                    .join("\n")
                : JSON.stringify(mcpResult);

            // Add result to execution for assertion evaluation
            execution.result = textOut || JSON.stringify(mcpResult);

            return {
                result: {
                    toolCallId: id,
                    content: textOut || JSON.stringify(mcpResult),
                    isError: false
                },
                execution
            };
        } catch (e) {
            traceMCPError(server.name, `tool call ${name} (${toolRegistration.originalToolName})`, e);
            
            const errorMsg = `Error calling tool: ${e instanceof Error ? e.message : String(e)}`;
            execution.result = errorMsg;
            
            return {
                result: {
                    toolCallId: id,
                    content: errorMsg,
                    isError: true
                },
                execution
            };
        }
    }

    private async generateFinalResponse(_toolResults: ToolResult[]): Promise<Response> {
        return await this.llm.generate(messages, {
            maxTokens: this.options.maxTokens,
            tools: this.tools
        });
    }

    getMessageSnapshot(): Message[] {
        return [...messages];
    }

    clearConversationHistory(): void {
        messages.length = 0;
        this.allToolExecutions.length = 0;
    }

    async evaluateAssertion(assertion: string): Promise<{ passed: boolean; reasoning: string }> {
        const toolExecutionLog = this.allToolExecutions.length > 0 
            ? this.allToolExecutions.map(e => `- ${e.serverName}/${e.originalToolName}${e.result ? ` -> ${e.result}` : ''}`).join('\n')
            : '(No tools were executed)';

        const evaluationPrompt = `You are evaluating test assertions against both the conversation history and the objective tool execution log.

TOOL EXECUTIONS FOR THIS TEST SESSION:
${toolExecutionLog}

ASSERTION TO EVALUATE:
${assertion}

EVALUATION INSTRUCTIONS:
1. When evaluating, prioritize ACTUAL TOOL EXECUTIONS over what the assistant claimed in its responses
2. If there's a contradiction between what was said and what tools were called, use the tool execution log as the source of truth
3. Focus on objective evidence: what tools were actually executed, in what order, and under what conditions
4. The tool execution log shows the definitive record of which tools were called

Please evaluate whether this assertion is TRUE or FALSE based on the evidence above.

Respond in this exact JSON format:
{
"passed": true/false,
"reasoning": "Brief explanation focusing on actual tool executions and objective evidence"
}`;

        try {
            const responseText = await this.llm.evaluate(this.getMessageSnapshot(), evaluationPrompt);

            // Parse the JSON response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return {
                    passed: false,
                    reasoning: "Failed to parse assertion evaluation response"
                };
            }

            const result = JSON.parse(jsonMatch[0]);
            return {
                passed: Boolean(result.passed),
                reasoning: result.reasoning || "No reasoning provided"
            };
        } catch (error) {
            return {
                passed: false,
                reasoning: `Error evaluating assertion: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    async cleanup() {
        for (const server of this.servers) {
            await server.client.close();
        }
    }
}