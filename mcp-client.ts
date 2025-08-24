import { Anthropic } from "@anthropic-ai/sdk";
import { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface MCPClientOptions {
    apiKey: string;
    model: string;
    maxTokens: number;
    clientName: string;
    clientVersion: string;
}

export class MCPClient {
    private mcp: Client;
    private anthropic: Anthropic;
    private transport: StdioClientTransport | null = null;
    private tools: Tool[] = [];
    private options: MCPClientOptions;

    constructor(options: MCPClientOptions) {
        this.options = options;
        this.anthropic = new Anthropic({
            apiKey: options.apiKey,
        });
        this.mcp = new Client({ 
            name: options.clientName, 
            version: options.clientVersion
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

            this.transport = new StdioClientTransport({ command, args: [serverScriptPath] });

            await this.mcp.connect(this.transport);

            const toolsResult = await this.mcp.listTools();
            this.tools = toolsResult.tools.map(t => ({
                name: t.name,
                description: t.description,
                input_schema: t.inputSchema,
            }));
            console.log("Connected to server with tools:", this.tools.map(t => t.name));
        } catch (e) {
            console.error("Failed to connect to MCP server:", e);
            throw e;
        }
    }

    async processQuery(query: string) {
        const messages: MessageParam[] = [{ role: "user", content: query }];

        let resp = await this.anthropic.messages.create({
            model: this.options.model,
            max_tokens: this.options.maxTokens,
            messages,
            tools: this.tools,
        });

        messages.push({ role: "assistant", content: resp.content });

        const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];

        for (const block of resp.content) {
            if (block.type === "tool_use") {
                const name = block.name;
                const args = (block.input as Record<string, unknown>) ?? {};
                const mcpResult = await this.mcp.callTool({ name, arguments: args });

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

            resp = await this.anthropic.messages.create({
                model: this.options.model,
                max_tokens: this.options.maxTokens,
                messages,
                tools: this.tools,
            });

            messages.push({ role: "assistant", content: resp.content });
        }

        const out: string[] = [];
        for (const b of resp.content) if (b.type === "text") out.push(b.text);
        return out.join("\n").trim();
    }

    async cleanup() {
        await this.mcp.close();
    }
}