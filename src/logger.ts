const isDebugEnabled = process.env.LOG_LEVEL === 'debug' || process.env.TRACE === 'true';

function timestamp() {
    return new Date().toISOString();
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
        console.debug(`[${timestamp()}] DEBUG: LLM Request [${provider}/${model}]`, {
            messageCount: messages.length,
            toolCount: tools.length,
            messages: summarizeMessages(messages),
            tools: summarizeTools(tools)
        });
    },

    llmResponse: (provider: string, model: string, response: any) => {
        if (!isDebugEnabled) return;
        console.debug(`[${timestamp()}] DEBUG: LLM Response [${provider}/${model}]`, {
            usage: response.usage,
            contentBlocks: response.content?.length || 0,
            stopReason: response.stop_reason
        });
    },

    llmError: (provider: string, model: string, operation: string, error: any) => {
        console.error(`[${timestamp()}] ERROR: LLM ${operation} failed [${provider}/${model}]`, {
            message: error.message,
            name: error.name,
            ...(error.status && { status: error.status })
        });
    },

    // MCP domain methods  
    mcpToolCall: (serverName: string, namespacedToolName: string, originalToolName: string, args: any) => {
        if (!isDebugEnabled) return;
        console.debug(`[${timestamp()}] DEBUG: MCP Tool Call [${serverName}]`, {
            namespacedTool: namespacedToolName,
            originalTool: originalToolName,
            argCount: Object.keys(args || {}).length,
            args: args
        });
    },

    mcpToolResult: (serverName: string, namespacedToolName: string, originalToolName: string, result: any) => {
        if (!isDebugEnabled) return;
        console.debug(`[${timestamp()}] DEBUG: MCP Tool Result [${serverName}]`, {
            namespacedTool: namespacedToolName,
            originalTool: originalToolName,
            isError: result.isError || false,
            contentLength: JSON.stringify(result).length,
            hasContent: !!result.content
        });
    },

    mcpError: (serverName: string, operation: string, error: any) => {
        console.error(`[${timestamp()}] ERROR: MCP ${operation} [${serverName}]`, {
            message: error.message,
            name: error.name,
            ...(error.code && { code: error.code })
        });
    }
};