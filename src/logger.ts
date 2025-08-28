const isDebugEnabled = process.env.LOG_LEVEL === 'debug' || process.env.TRACE === 'true';

function timestamp() {
    return new Date().toISOString();
}

function redactSensitive(obj: any): any {
    if (typeof obj === 'string') {
        // Redact potential API keys, tokens, etc.
        return obj.replace(/\b(sk-[a-zA-Z0-9]+|xoxb-[a-zA-Z0-9-]+|Bearer\s+[a-zA-Z0-9_-]+)/gi, '[REDACTED]');
    }
    if (Array.isArray(obj)) {
        return obj.map(redactSensitive);
    }
    if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = redactSensitive(value);
        }
        return result;
    }
    return obj;
}

function summarizeMessages(messages: any[]): any {
    return messages.map(msg => ({
        role: msg.role,
        contentType: typeof msg.content,
        contentLength: typeof msg.content === 'string' ? msg.content.length : JSON.stringify(msg.content).length
    }));
}

function summarizeTools(tools: any[]): string[] {
    return tools.map(t => t.name || t.toString());
}

export const logger = {
    // LLM domain methods
    llmRequest: (provider: string, model: string, messages: any[], tools: any[]) => {
        if (!isDebugEnabled) return;
        console.debug(`[${timestamp()}] DEBUG: LLM Request [${provider}/${model}]`, redactSensitive({
            messageCount: messages.length,
            toolCount: tools.length,
            messages: summarizeMessages(messages),
            tools: summarizeTools(tools)
        }));
    },

    llmResponse: (provider: string, model: string, response: any) => {
        if (!isDebugEnabled) return;
        console.debug(`[${timestamp()}] DEBUG: LLM Response [${provider}/${model}]`, redactSensitive({
            usage: response.usage,
            contentBlocks: response.content?.length || 0,
            stopReason: response.stop_reason
        }));
    },

    llmError: (provider: string, model: string, operation: string, error: any) => {
        console.error(`[${timestamp()}] ERROR: LLM ${operation} failed [${provider}/${model}]`, redactSensitive({
            message: error.message,
            name: error.name,
            ...(error.status && { status: error.status })
        }));
    },

    // MCP domain methods  
    mcpToolCall: (serverName: string, toolName: string, args: any) => {
        if (!isDebugEnabled) return;
        console.debug(`[${timestamp()}] DEBUG: MCP Tool Call [${serverName}]`, redactSensitive({
            toolName,
            argCount: Object.keys(args || {}).length,
            args: args
        }));
    },

    mcpToolResult: (serverName: string, toolName: string, result: any) => {
        if (!isDebugEnabled) return;
        console.debug(`[${timestamp()}] DEBUG: MCP Tool Result [${serverName}]`, redactSensitive({
            toolName,
            isError: result.isError || false,
            contentLength: JSON.stringify(result).length,
            hasContent: !!result.content
        }));
    },

    mcpError: (serverName: string, operation: string, error: any) => {
        console.error(`[${timestamp()}] ERROR: MCP ${operation} [${serverName}]`, redactSensitive({
            message: error.message,
            name: error.name,
            ...(error.code && { code: error.code })
        }));
    }
};