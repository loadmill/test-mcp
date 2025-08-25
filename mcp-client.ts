import { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { LLM } from "./llm.js";

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

export class MCPClient {
    private servers: ServerConnection[] = [];
    private llm: LLM;
    private tools: Tool[] = [];
    private options: MCPClientOptions;

    constructor(llm: LLM, options: MCPClientOptions) {
        this.llm = llm;
        this.options = options;
    }

    async connectToServer(name: string, config: ServerConfig) {
        try {
            const transport = new StdioClientTransport({ 
                command: config.command, 
                args: config.args,
                env: config.env 
            });
            const client = new Client({ 
                name: `${this.options.clientName}-${name}`, 
                version: this.options.clientVersion 
            });

            await client.connect(transport);

            const toolsResult = await client.listTools();
            const serverTools = toolsResult.tools.map(t => ({
                name: t.name,
                description: t.description,
                input_schema: t.inputSchema,
            }));

            this.servers.push({
                client,
                transport,
                name
            });

            this.tools.push(...serverTools);
            console.log(`Connected to server '${name}' with tools:`, serverTools.map(t => t.name));
        } catch (e) {
            console.error(`Failed to connect to MCP server '${name}':`, e);
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
                
                // Find which server has this tool
                let mcpResult = null;
                for (const server of this.servers) {
                    try {
                        mcpResult = await server.client.callTool({ name, arguments: args });
                        break;
                    } catch (e) {
                        // Tool not found on this server, try next
                        continue;
                    }
                }

                if (!mcpResult) {
                    throw new Error(`Tool '${name}' not found on any connected server`);
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
        for (const b of response.content) if (b.type === "text") out.push(b.text);
        return out.join("\n").trim();
    }

    getMessageSnapshot(): MessageParam[] {
        return [...messages];
    }

    async evaluateAssertion(assertion: string): Promise<{ passed: boolean; reasoning: string }> {
        const conversationSummary = this.getMessageSnapshot().map(msg => {
            if (msg.role === 'user') {
                if (typeof msg.content === 'string') {
                    return `User: ${msg.content}`;
                } else if (Array.isArray(msg.content)) {
                    return `User: ${msg.content.map((c: any) => 
                        c.type === 'text' ? c.text : 
                        c.type === 'tool_result' ? `[Tool Result: ${c.content}]` : 
                        '[Unknown Content]'
                    ).join(' ')}`;
                }
            } else if (Array.isArray(msg.content)) {
                return `Assistant: ${msg.content.map((c: any) => 
                    c.type === 'text' ? c.text :
                    c.type === 'tool_use' ? `[Used tool: ${c.name}]` :
                    '[Unknown Content]'
                ).join(' ')}`;
            }
            return 'Unknown message';
        }).join('\n');

        const evaluationPrompt = `You are evaluating test assertions against a conversation history.

CONVERSATION HISTORY:
${conversationSummary}

ASSERTION TO EVALUATE:
${assertion}

Please evaluate whether this assertion is TRUE or FALSE based on the conversation history above. 

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