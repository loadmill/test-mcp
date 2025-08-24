import readline from "readline/promises";
import { MCPClient, MCPClientOptions } from "./mcp-client.js";
import { loadMCPConfig } from "./config-loader.js";

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
    const configPath = process.argv[2] || "mcp.config.json";
    let mcpClient: MCPClient | null = null;
    
    try {
        const config = loadMCPConfig(configPath);
        
        const clientOptions: MCPClientOptions = {
            apiKey: config.mcpClient.apiKey,
            model: config.mcpClient.model,
            maxTokens: 1000,
            clientName: "mcp-client-cli",
            clientVersion: "1.0.0",
        };
        
        mcpClient = new MCPClient(clientOptions);
        
        await mcpClient.connectToServers(config.mcpServers);
        await chatLoop(mcpClient);
    } catch (err) {
        console.error("Fatal error:", err);
        if (err instanceof Error && err.message.includes("Config file not found")) {
            console.log("Usage: node build/index.js [config-file-path]");
            console.log("Default config file: mcp.config.json");
        }
    } finally {
        if (mcpClient) {
            await mcpClient.cleanup();
        }
    }
}