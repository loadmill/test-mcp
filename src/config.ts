import dotenv from "dotenv";

dotenv.config();

function getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not set`);
    }
    return value;
}

export const config = {
    anthropicApiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
    defaultModel: "claude-3-7-sonnet-latest",
    maxTokens: 1000,
    clientName: "mcp-client-cli",
    clientVersion: "1.0.0",
};
