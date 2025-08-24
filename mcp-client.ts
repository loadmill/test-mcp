import { Anthropic } from "@anthropic-ai/sdk";
import { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// message history for the whole run
const messages: MessageParam[] = [];

export interface MCPClientOptions {
    apiKey: string;
    model: string;
    maxTokens: number;
    clientName: string;
    clientVersion: string;
}

interface ServerConnection {
    client: Client;
    transport: StdioClientTransport;
    name: string;
}

export class MCPClient {
    private servers: ServerConnection[] = [];
    private anthropic: Anthropic;
    private tools: Tool[] = [];
    private options: MCPClientOptions;

    constructor(options: MCPClientOptions) {
        this.options = options;
        this.anthropic = new Anthropic({
            apiKey: options.apiKey,
        });
    }

    async connectToServer(serverScriptPath: string) {
        try {
            const isJs = serverScriptPath.endsWith(".js");
            const isPy = serverScriptPath.endsWith(".py");
            if (!isJs && !isPy) throw new Error("Server script must be a .js or .py file");

            const command = isPy
                ? (process.platform === "win32" ? "python" : "python3")
                : process.execPath;

            const transport = new StdioClientTransport({ command, args: [serverScriptPath] });
            const client = new Client({ 
                name: `${this.options.clientName}-${this.servers.length}`, 
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
                name: serverScriptPath.split('/').pop() || serverScriptPath
            });

            this.tools.push(...serverTools);
            console.log(`Connected to server ${serverScriptPath} with tools:`, serverTools.map(t => t.name));
        } catch (e) {
            console.error("Failed to connect to MCP server:", serverScriptPath, e);
            throw e;
        }
    }

    async connectToServers(serverScriptPaths: string[]) {
        for (const serverPath of serverScriptPaths) {
            await this.connectToServer(serverPath);
        }
        console.log("All servers connected. Total tools:", this.tools.map(t => t.name));
    }

    async processQuery(query: string) {
        // const messages: MessageParam[] = [{ role: "user", content: query }];
        messages.push({ role: "user", content: query });

        let response = await this.anthropic.messages.create({
            model: this.options.model,
            max_tokens: this.options.maxTokens,
            messages,
            tools: this.tools,
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

            response = await this.anthropic.messages.create({
                model: this.options.model,
                max_tokens: this.options.maxTokens,
                messages,
                tools: this.tools,
            });

            messages.push({ role: "assistant", content: response.content });
        }

        const out: string[] = [];
        for (const b of response.content) if (b.type === "text") out.push(b.text);
        return out.join("\n").trim();
    }

    async cleanup() {
        for (const server of this.servers) {
            await server.client.close();
        }
    }
}