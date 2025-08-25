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


export interface MCPConfig {
    version: string;
    mcpClient: {
        provider: string;
        model: string;
        api_key_env: string;
    };
    mcpServers: {
        [name: string]: {
            command: string;
            args: string[];
            env?: {
                [key: string]: string;
            };
        };
    };
}

export interface ResolvedMCPConfig {
    version: string;
    mcpClient: {
        provider: string;
        model: string;
        apiKey: string;
    };
    mcpServers: {
        [name: string]: {
            command: string;
            args: string[];
            env?: {
                [key: string]: string;
            };
        };
    };
}