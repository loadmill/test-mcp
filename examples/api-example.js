/**
 * Example of using test-mcp programmatically with Node.js
 */
import 'dotenv/config';
import { TestMCPClient } from '../build/index.js';

async function main() {
    console.log('Creating test-mcp client...\n');

    // Create client with configuration
    const client = new TestMCPClient({
        llm: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            apiKey: process.env.OPENAI_API_KEY,
            maxTokens: 1000
        },
        servers: {
            dice: {
                type: 'stdio',
                command: 'node',
                args: ['examples/dice-mcp-server.js']
            }
        },
        options: {
            clientName: 'api-example',
            clientVersion: '1.0.0',
            trace: false
        }
    });

    try {
        // Connect to servers
        console.log('Connecting to MCP servers...');
        await client.connect();
        console.log('✓ Connected!\n');

        // Execute a prompt
        console.log('Executing prompt: "Roll the dice"');
        const response = await client.prompt('Roll the dice');
        console.log('Response:', response.text);
        console.log('Tool calls:', response.toolCalls.length);
        console.log('\n');

        // Run an assertion
        console.log('Running assertion...');
        const assertionResult = await client.assert('The dice was rolled successfully');
        console.log('Assertion passed:', assertionResult.passed);
        console.log('Reasoning:', assertionResult.reasoning);
        console.log('\n');

        // Clear history and try another prompt
        console.log('Clearing history and trying another prompt...');
        client.clearHistory();

        const response2 = await client.prompt('Roll the dice again');
        console.log('Response:', response2.text);
        console.log('\n');

        console.log('✓ All operations completed successfully!');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        // Cleanup
        await client.disconnect();
        console.log('\n✓ Disconnected from servers');
    }
}

main();
