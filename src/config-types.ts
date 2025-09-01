/**
 * Config types are split into two stages:
 *
 * - MCPConfig: the raw JSON as it exists on disk. It may still contain
 *   placeholders like "${env:VAR_NAME}" that need resolution.
 *
 * - ResolvedMCPConfig: the runtime-ready form after environment
 *   substitution. All placeholders are guaranteed to be replaced with
 *   plain strings so consumers don’t need to handle resolution logic.
 *
 * This separation makes it explicit where env resolution happens and
 * allows us to validate or lint the raw config separately if needed.
 */


interface StdioServerConfig {
    type: "stdio";
    command: string;
    args: string[];
    env?: {
        [key: string]: string;
    };
}

interface HttpServerConfig {
    type: "http";
    url: string;
    headers?: {
        [key: string]: string;
    };
}

export interface MCPConfig {
    mcpClient: {
        provider: string;
        model: string;
        api_key: string;
    };
    mcpServers: {
        [name: string]: StdioServerConfig | HttpServerConfig;
    };
}

interface ResolvedStdioServerConfig {
    type: "stdio";
    command: string;
    args: string[];
    env?: {
        [key: string]: string;
    };
}

interface ResolvedHttpServerConfig {
    type: "http";
    url: string;
    headers?: {
        [key: string]: string;
    };
}

export interface ResolvedMCPConfig {
    mcpClient: {
        provider: string;
        model: string;
        apiKey: string;
    };
    mcpServers: {
        [name: string]: ResolvedStdioServerConfig | ResolvedHttpServerConfig;
    };
}
