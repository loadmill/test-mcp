import { Anthropic } from "@anthropic-ai/sdk";
import {
    MessageParam,
    Tool,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import readline from "readline/promises";

import dotenv from "dotenv";

dotenv.config(); // load environment variables from .env

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
}

class MCPClient {
    private mcp: Client;
    private anthropic: Anthropic;
    private transport: StdioClientTransport | null = null;
    private tools: Tool[] = [];

    constructor() {
        // Initialize Anthropic client and MCP client
        this.anthropic = new Anthropic({
            apiKey: ANTHROPIC_API_KEY,
        });
        this.mcp = new Client({ name: "mcp-client-cli", version: "1.0.0" });
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

            // ✅ Await the connection
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
            model: "claude-3-7-sonnet-latest",
            max_tokens: 1000,
            messages,
            tools: this.tools,
        });

        // record assistant turn (may include tool_use)
        messages.push({ role: "assistant", content: resp.content });

        // gather tool results
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
            // ✅ tool_result blocks must be in a user message
            messages.push({ role: "user", content: toolResults });

            resp = await this.anthropic.messages.create({
                model: "claude-3-7-sonnet-latest",
                max_tokens: 1000,
                messages,
                tools: this.tools,
            });

            messages.push({ role: "assistant", content: resp.content });
        }

        const out: string[] = [];
        for (const b of resp.content) if (b.type === "text") out.push(b.text);
        return out.join("\n").trim();
    }




    async chatLoop() {
        /**
         * Run an interactive chat loop
         */
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        try {
            console.log("\nMCP Client Started!");
            console.log("Type your queries or 'quit' to exit.");

            while (true) {
                const message = await rl.question("\nQuery: ");
                if (message.toLowerCase() === "quit") {
                    break;
                }
                const response = await this.processQuery(message);
                console.log("\n" + response);
            }
        } finally {
            rl.close();
        }
    }

    async cleanup() {
        /**
         * Clean up resources
         */
        await this.mcp.close();
    }
}

async function main() {
    if (process.argv.length < 3) {
        console.log("Usage: node build/index.js <path_to_server_script>");
        return;
    }
    const mcpClient = new MCPClient();
    try {
        await mcpClient.connectToServer(process.argv[2]);
        await mcpClient.chatLoop();
    } catch (err) {
        console.error("Fatal error:", err);
    } finally {
        await mcpClient.cleanup();
    }
}


main();