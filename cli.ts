import readline from "readline/promises";
import { MCPClient, MCPClientOptions } from "./mcp-client.js";
import { config } from "./config.js";

export async function chatLoop(mcpClient: MCPClient) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    try {
        console.log("MCP Client Started!");
        console.log("Type your queries or 'quit' to exit.");

        while (true) {
            const message = await rl.question("\nQuery: ");
            if (message.toLowerCase() === "quit") {
                break;
            }
            const response = await mcpClient.processQuery(message);
            console.log("\n" + response);
        }
    } finally {
        rl.close();
    }
}

export async function main() {
    if (process.argv.length < 3) {
        console.log("Usage: node build/index.js <path_to_server_script>");
        return;
    }
    
    const clientOptions: MCPClientOptions = {
        apiKey: config.anthropicApiKey,
        model: config.defaultModel,
        maxTokens: config.maxTokens,
        clientName: config.clientName,
        clientVersion: config.clientVersion,
    };
    
    const mcpClient = new MCPClient(clientOptions);
    
    try {
        await mcpClient.connectToServer(process.argv[2]);
        await chatLoop(mcpClient);
    } catch (err) {
        console.error("Fatal error:", err);
    } finally {
        await mcpClient.cleanup();
    }
}