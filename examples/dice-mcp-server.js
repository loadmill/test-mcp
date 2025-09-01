#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

function randomNumber() {
  return Math.floor(Math.random() * 6) + 1;
}

const server = new McpServer({
  name: "random-server",
  version: "0.0.1",
});

server.tool(
  "rollDice",
  {}, // no params
  async () => ({
    content: [{ type: "text", text: String(randomNumber()) }],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.log("random-server ready on stdio");
