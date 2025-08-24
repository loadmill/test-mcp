import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { MCPConfig, ResolvedMCPConfig } from "./config-types.js";

// Load environment variables
dotenv.config();

function resolveEnvVariable(value: string): string {
    const envMatch = value.match(/^\${env:(.+)}$/);
    if (envMatch) {
        const envVar = process.env[envMatch[1]];
        if (!envVar) {
            throw new Error(`Environment variable ${envMatch[1]} is not set`);
        }
        return envVar;
    }
    return value;
}

function resolveEnvVariables(obj: any): any {
    if (typeof obj === "string") {
        return resolveEnvVariable(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(resolveEnvVariables);
    }
    if (obj !== null && typeof obj === "object") {
        const resolved: any = {};
        for (const [key, value] of Object.entries(obj)) {
            resolved[key] = resolveEnvVariables(value);
        }
        return resolved;
    }
    return obj;
}

export function loadMCPConfig(configPath: string = "mcp.config.json"): ResolvedMCPConfig {
    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found: ${configPath}`);
    }

    const configContent = fs.readFileSync(configPath, "utf-8");
    let config: MCPConfig;
    
    try {
        config = JSON.parse(configContent);
    } catch (error) {
        throw new Error(`Invalid JSON in config file: ${error}`);
    }

    // Resolve environment variables
    const resolved = resolveEnvVariables(config);

    // Transform to resolved config format
    const resolvedConfig: ResolvedMCPConfig = {
        version: resolved.version,
        mcpClient: {
            provider: resolved.mcpClient.provider,
            model: resolved.mcpClient.model,
            apiKey: resolved.mcpClient.api_key_env,
        },
        mcpServers: resolved.mcpServers,
    };

    return resolvedConfig;
}