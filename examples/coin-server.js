#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

function flipCoin() {
  return Math.random() < 0.5 ? "heads" : "tails";
}

const server = new McpServer({
  name: "coin-server",
  version: "0.0.1",
});

server.tool(
  "flipCoin",
  {}, // no params
  async () => ({
    content: [{ type: "text", text: flipCoin() }],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.log("coin-server ready on stdio");