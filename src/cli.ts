import readline from "readline/promises";
import minimist from "minimist";
import { MCPClient, MCPClientOptions } from "./mcp-client.js";
import { loadMCPConfig } from "./config-loader.js";
import { TestRunner } from "./test-runner.js";
import { createLLM } from "./llm.js";

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
    const args = minimist(process.argv.slice(2), {
        boolean: ['interactive', 'i', 'help', 'h'],
        string: ['config', 'c', 'tests-dir', 't'],
        default: {
            config: 'mcp.config.json',
            'tests-dir': 'tests'
        },
        alias: {
            'interactive': 'i',
            'config': 'c',
            'tests-dir': 't',
            'help': 'h'
        }
    });

    if (args.help) {
        console.log('test-mcp – Automated MCP Test Runner and Client');
        console.log('');
        console.log('Usage: node build/index.js [options]');
        console.log('');
        console.log('Options:');
        console.log('  -i, --interactive     Run in interactive chat mode');
        console.log('  -c, --config <file>   Config file path (default: mcp.config.json)');
        console.log('  -t, --tests-dir <dir> Tests directory (default: tests)');
        console.log('  -h, --help            Show help');
        console.log('');
        console.log('Examples:');
        console.log('  node build/index.js                           # Run tests (default mode)');
        console.log('  node build/index.js -i                        # Interactive mode');
        console.log('  node build/index.js -c my-config.json         # Use custom config');
        console.log('  node build/index.js -t ./my-tests             # Use custom tests directory');
        console.log('  node build/index.js -i -c my-config.json      # Interactive with custom config');
        return;
    }

    const interactiveMode = args.interactive;
    const configPath = args.config;
    const testsDir = args['tests-dir'];

    let mcpClient: MCPClient | null = null;
    
    try {
        const config = loadMCPConfig(configPath);
        
        const llm = createLLM(config.mcpClient);
        
        const clientOptions: MCPClientOptions = {
            maxTokens: 1000,
            clientName: "mcp-client-cli",
            clientVersion: "1.0.0",
        };
        
        mcpClient = new MCPClient(llm, clientOptions);
        
        await mcpClient.connectToServers(config.mcpServers);
        
        if (interactiveMode) {
            console.log("💬 Running in interactive mode");
            await chatLoop(mcpClient);
        } else {
            console.log("🧪 Running tests (default mode)");
            const testRunner = new TestRunner(mcpClient);
            const results = await testRunner.runAllTests(testsDir);
            
            // Exit with appropriate code
            const allPassed = results.every(r => r.passed);
            process.exit(allPassed ? 0 : 1);
        }
    } catch (err) {
        console.error("Fatal error:", err);
        if (err instanceof Error && err.message.includes("Config file not found")) {
            console.log("Run with --help for usage information");
        }
        process.exit(1);
    } finally {
        if (mcpClient) {
            await mcpClient.cleanup();
        }
    }
}