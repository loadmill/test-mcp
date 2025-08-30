import { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { LLM } from "./llm.js";
import { traceMCPToolCall, traceMCPToolResult, traceMCPError } from "./tracing.js";

// message history for the whole run
const messages: MessageParam[] = [];

export interface MCPClientOptions {
    maxTokens: number;
    clientName: string;
    clientVersion: string;
}

interface ServerConnection {
    client: Client;
    transport: StdioClientTransport;
    name: string;
}

interface ServerConfig {
    command: string;
    args: string[];
    env?: {
        [key: string]: string;
    };
}

interface ToolRegistration {
    serverName: string;
    originalToolName: string;
}

export class MCPClient {
    private servers: ServerConnection[] = [];
    private llm: LLM;
    private tools: Tool[] = [];
    private toolRegistry: Map<string, ToolRegistration> = new Map(); // namespacedToolName -> {serverName, originalToolName}
    private options: MCPClientOptions;
    constructor(llm: LLM, options: MCPClientOptions) {
        this.llm = llm;
        this.options = options;
    }

    async connectToServer(serverName: string, config: ServerConfig) {
        try {
            const transport = new StdioClientTransport({
                command: config.command,
                args: config.args,
                env: config.env
            });
            const client = new Client({
                name: `${this.options.clientName}-${serverName}`,
                version: this.options.clientVersion
            });

            await client.connect(transport);

            const toolsResult = await client.listTools();
            const serverTools = toolsResult.tools.map(tool => {
                const namespacedName = `${serverName}_${tool.name}`;
                return {
                    name: namespacedName, // Use namespaced name for LLM
                    description: tool.description,
                    input_schema: tool.inputSchema,
                };
            });

            this.servers.push({
                client,
                transport,
                name: serverName
            });

            // Register each tool with its namespaced name and original details
            for (const originalTool of toolsResult.tools) {
                const namespacedName = `${serverName}_${originalTool.name}`;
                this.toolRegistry.set(namespacedName, {
                    serverName: serverName,
                    originalToolName: originalTool.name
                });
            }

            this.tools.push(...serverTools);
            console.log(`Connected to server '${serverName}' with tools:`, serverTools.map(t => t.name));
        } catch (e) {
            console.error(`Failed to connect to MCP server '${serverName}':`, e);
            throw e;
        }
    }

    async connectToServers(servers: { [name: string]: ServerConfig }) {
        for (const [name, config] of Object.entries(servers)) {
            await this.connectToServer(name, config);
        }
        console.log("All servers connected. Total tools:", this.tools.map(t => t.name));
    }

    async processQuery(query: string) {
        // const messages: MessageParam[] = [{ role: "user", content: query }];
        messages.push({ role: "user", content: query });

        let response = await this.llm.generate(messages, {
            maxTokens: this.options.maxTokens,
            tools: this.tools
        });

        messages.push({ role: "assistant", content: response.content });

        const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];

        for (const block of response.content) {
            if (block.type === "tool_use") {
                const name = block.name;
                const args = (block.input as Record<string, unknown>) ?? {};

                // Look up which server has this namespaced tool
                const toolRegistration = this.toolRegistry.get(name);
                if (!toolRegistration) {
                    throw new Error(`Tool '${name}' not found on any connected server`);
                }

                const server = this.servers.find(s => s.name === toolRegistration.serverName);
                if (!server) {
                    throw new Error(`Server '${toolRegistration.serverName}' for tool '${name}' is not connected`);
                }

                traceMCPToolCall(server.name, name, toolRegistration.originalToolName, args);
                
                let mcpResult;
                try {
                    // Call the tool using its original name on the server
                    mcpResult = await server.client.callTool({ 
                        name: toolRegistration.originalToolName, 
                        arguments: args 
                    });
                    traceMCPToolResult(server.name, name, toolRegistration.originalToolName, mcpResult);
                } catch (e) {
                    traceMCPError(server.name, `tool call ${name} (${toolRegistration.originalToolName})`, e);
                    throw e;
                }

                const textOut = Array.isArray(mcpResult.content)
                    ? mcpResult.content
                        .map((c: any) => (c?.type === "text" ? c.text : typeof c === "string" ? c : ""))
                        .filter(Boolean)
                        .join("\n")
                    : JSON.stringify(mcpResult);

                toolResults.push({
                    type: "tool_result",
                    tool_use_id: block.id,
                    content: textOut || JSON.stringify(mcpResult),
                });
            }
        }

        if (toolResults.length > 0) {
            messages.push({ role: "user", content: toolResults });

            response = await this.llm.generate(messages, {
                maxTokens: this.options.maxTokens,
                tools: this.tools
            });

            messages.push({ role: "assistant", content: response.content });
        }

        const out: string[] = [];
        for (const b of response.content) {if (b.type === "text") {out.push(b.text);}}
        return out.join("\n").trim();
    }

    getMessageSnapshot(): MessageParam[] {
        return [...messages];
    }

    async evaluateAssertion(assertion: string): Promise<{ passed: boolean; reasoning: string }> {
        const evaluationPrompt = `You are evaluating test assertions against the conversation history above.

ASSERTION TO EVALUATE:
${assertion}

Please evaluate whether this assertion is TRUE or FALSE based on the conversation history. 

Respond in this exact JSON format:
{
"passed": true/false,
"reasoning": "Brief explanation of why the assertion passed or failed"
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
