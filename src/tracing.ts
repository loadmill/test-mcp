import pino from "pino";
import fs from "fs";

// Create traces directory if it doesn't exist
if (!fs.existsSync("traces")) {
    fs.mkdirSync("traces", { recursive: true });
}

function createLogger() {
    const isTraceEnabled = process.env.TRACE === "true";

    return pino({
        level: isTraceEnabled ? "debug" : "info",
        transport: isTraceEnabled ? {
            target: "pino/file",
            options: {
                destination: `traces/mcp-trace-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`
            }
        } : undefined,
        formatters: {
            level: (label) => ({ level: label })
        }
    });
}

// Logger instance - initialized explicitly after CLI parsing
let logger: any = null;

export function initializeTracing() {
    logger = createLogger();
}

// Domain-specific logging functions
export const traceLLMRequest = (provider: string, model: string, messages: any[], tools: any[]) => {
    logger.debug({
        category: "llm_request",
        provider,
        model,
        messageCount: messages?.length || 0,
        toolCount: tools?.length || 0,
        messages: (messages || []).map(msg => ({
            role: msg?.role,
            contentType: typeof msg?.content,
            contentLength: typeof msg?.content === "string" ? msg.content.length : JSON.stringify(msg?.content || {}).length
        })),
        tools: (tools || []).map(t => t?.name || t?.toString() || "unknown")
    }, "LLM Request");
};

export const traceLLMResponse = (provider: string, model: string, response: any) => {
    logger.debug({
        category: "llm_response",
        provider,
        model,
        usage: response.usage,
        contentBlocks: response.content?.length || 0,
        stopReason: response.stop_reason
    }, "LLM Response");
};

export const traceLLMError = (provider: string, model: string, operation: string, error: any) => {
    logger.error({
        category: "llm_error",
        provider,
        model,
        operation,
        message: error.message,
        name: error.name,
        ...(error.status && { status: error.status })
    }, `LLM ${operation} failed`);
};

export const traceMCPToolCall = (serverName: string, namespacedToolName: string, originalToolName: string, args: any, transport?: string) => {
    logger.debug({
        category: "mcp_tool_call",
        server: serverName,
        namespacedTool: namespacedToolName,
        originalTool: originalToolName,
        transport: transport || "unknown",
        argCount: Object.keys(args || {}).length,
        args
    }, "MCP Tool Call");
};

export const traceMCPToolResult = (serverName: string, namespacedToolName: string, originalToolName: string, result: any, transport?: string) => {
    logger.debug({
        category: "mcp_tool_result",
        server: serverName,
        namespacedTool: namespacedToolName,
        originalTool: originalToolName,
        transport: transport || "unknown",
        isError: result.isError || false,
        contentLength: JSON.stringify(result).length,
        hasContent: !!result.content
    }, "MCP Tool Result");
};

export const traceMCPError = (serverName: string, operation: string, error: any) => {
    logger.error({
        category: "mcp_error",
        server: serverName,
        operation,
        message: error.message,
        name: error.name,
        ...(error.code && { code: error.code })
    }, `MCP ${operation} failed`);
};
