# 📦 test-mcp

<p align="center">
  <a href="https://www.npmjs.com/package/@loadmill/test-mcp"><img src="https://img.shields.io/npm/v/@loadmill/test-mcp?color=green" alt="npm version"></a>
  <a href="https://discord.gg/BHAVZUFrWX"><img src="https://img.shields.io/discord/1412375815236091906?logo=discord&label=discord" alt="Discord"></a>
</p>

<p align="center">
  <a href="#whats-test-mcp">What's test-mcp?</a> •
  <a href="#installation">Installation</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#configuration--test-format">Configuration & Test Format</a> •
  <a href="#how-to-run">How to Run</a> •
  <a href="#cli-flags">CLI Flags</a> •
  <a href="#test-discovery">Test Discovery</a> •
  <a href="#interactive-mode">Interactive Mode</a> •
  <a href="#roadmap">Roadmap</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

---

**`test-mcp`** is the first headless [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) client for automated testing.  
If you’re building an MCP server, test-mcp helps you validate it end-to-end in a fast and repeatable way.

https://github.com/user-attachments/assets/c4e5295b-7217-47f2-96d9-76befcea8b21

---

<h2 id="whats-test-mcp">💡 What's `test-mcp`?</h2>

`test-mcp` gives you three core components:

* **Configuration** – define your MCP servers and LLM provider in a single JSON file.
* **Test Files** – write flows of natural-language prompts and assertions in YAML.
* **Runner** – run tests from the CLI, get clear pass/fail results.

Together, these let you automate and validate MCP server behavior with simple, repeatable tests.

**Supported Transports & Providers:**
- **MCP Servers**: STDIO (local) and HTTP (remote)
- **LLM Providers**: Anthropic Claude and OpenAI GPT models

---

<h2 id="installation">🏗️ Installation</h2>

```bash
# using npm
npm install -g @loadmill/test-mcp

# or with pnpm
pnpm add -g @loadmill/test-mcp
````

When running from source:

```bash
git clone https://github.com/loadmill/test-mcp
cd test-mcp
npm install
# For OpenAI (default example)
echo "OPENAI_API_KEY=your_api_key_here" > .env
# Or for Anthropic
echo "ANTHROPIC_API_KEY=your_api_key_here" > .env
npm run build
```

---

<h2 id="getting-started">🚀 Getting Started</h2>

To try `test-mcp` quickly with the included examples:

```bash
# from source
node build/index.js
```

This will run a demonstration that shows both local STDIO and remote HTTP MCP servers working together. The test rolls a local dice server and queries a remote MCP server registry.

---

<h2 id="configuration--test-format">📑 Configuration & Test Format</h2>

**1) Example config (`mcp.config.json`)**

```json
{
  "mcpClient": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "api_key": "${env:OPENAI_API_KEY}"
  },
  "mcpServers": {
    "loadmill": {
      "type": "stdio",
      "command": "npx",
      "args": ["@loadmill/mcp"],
      "env": {
        "LOADMILL_API_TOKEN": "${env:LOADMILL_API_TOKEN}"
      }
    }
  }
}
```

OpenAI is also supported - see configuration variations in the `examples/` folder.

**2) Example test (`tests/bank-transaction.test.yaml`)**

```yaml
description: "Maker Checker Bank - Transaction Creation and Rejection Flow"

steps:
  - prompt: "Login with username alice and password alice123 and transfer $100 to Bob"
  - prompt: "Login with username bob and password bob456, reject transaction from Alice"
  - assert: "Validate the transaction was created and rejected successfully"
```

---

<h2 id="how-to-run">▶️ How to run</h2>

By default, `test-mcp` looks for `mcp.config.json` in the project root and runs tests in the `tests/` folder.

**Globally installed:**

```bash
test-mcp
```

**From source:**

```bash
node build/index.js
```

Point to a specific config or tests directory:

```bash
test-mcp --config mcp.config.json --tests-dir ./tests
```

---

<h2 id="cli-flags">💻 CLI Flags</h2>

```
Options:
  -c, --config <file>   Path to config file (default: mcp.config.json)
  -t, --tests-dir <dir> Directory containing test files (default: tests)
  -i, --interactive     Run in interactive chat mode
      --trace           Enable detailed tracing output
  -h, --help            Show help
```

---

<h2 id="test-discovery">🔎 Test Discovery</h2>

All files ending in `.test.yaml` under the `tests/` directory are executed.
Recursive discovery and full glob patterns are planned for later.

---

<h2 id="interactive-mode">💬 Interactive Mode</h2>

Run the client without tests and chat with your MCP servers:

```bash
test-mcp -i
```

---

<h2 id="roadmap">🛣️ Roadmap</h2>

* [x] Headless MCP client with Anthropic support
* [x] Support for `stdio` transport
* [x] Evaluator for natural-language assertions
* [x] OpenAI support
* [x] Support for `http` transport
* [ ] CI-friendly reports
* [ ] Subfolder/glob test discovery

---

<h2 id="contributing">🤝 Contributing</h2>

Contributions, ideas, and bug reports are welcome! See [CONTRIBUTING.md](https://github.com/loadmill/test-mcp/blob/main/.github/CONTRIBUTING.md).

---

<h2 id="license">📄 License</h2>

Apache License 2.0 © [Loadmill](https://github.com/loadmill/test-mcp/blob/main/LICENSE)
