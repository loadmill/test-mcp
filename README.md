# 📦 test-mcp

<p align="center">
  <a href="https://www.npmjs.com/package/@loadmill/test-mcp"><img src="https://img.shields.io/npm/v/@loadmill/test-mcp?color=green" alt="npm version"></a>
  <a href="https://discord.gg/ABC"><img src="https://img.shields.io/discord/123?logo=discord&label=discord" alt="Discord"></a>
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

---

## 💡 What's `test-mcp`? {#whats-test-mcp}

`test-mcp` gives you three core components:

* **Configuration** – define your MCP servers and LLM provider in a single JSON file.
* **Test Files** – write flows of natural-language prompts and assertions in YAML.
* **Runner** – run tests from the CLI, get clear pass/fail results.

Together, these let you automate and validate MCP server behavior with simple, repeatable tests.

---

## 🏗️ Installation {#installation}

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
echo "ANTHROPIC_API_KEY=your_api_key_here" > .env
npm run build
```

---

## 🚀 Getting Started {#getting-started}

To try `test-mcp` quickly with the included examples:

```bash
# from source
node build/index.js
```

Example MCP servers are available in the `examples/` folder and a sample `mcp.config.json` is provided in the repo.

---

## 📑 Configuration & Test Format {#configuration--test-format}

**1) Example config (`mcp.config.json`)**

```json
{
  "version": "0.1",
  "mcpClient": {
    "provider": "anthropic",
    "model": "claude-3-7-sonnet-latest",
    "api_key_env": "${env:ANTHROPIC_API_KEY}"
  },
  "mcpServers": {
    "loadmill": {
      "command": "npx",
      "args": ["@loadmill/mcp"],
      "env": {
        "LOADMILL_API_TOKEN": "${env:LOADMILL_API_TOKEN}"
      }
    }
  }
}
```

**2) Example test (`tests/bank-transaction.test.yaml`)**

```yaml
description: "Maker Checker Bank - Transaction Creation and Rejection Flow"

steps:
  - prompt: "Login with username alice and password alice123 and transfer $100 to Bob"
  - prompt: "Login with username bob and password bob456, reject transaction from Alice"
  - assert: "Validate the transaction was created and rejected successfully"
```

---

## ▶️ How to run {#how-to-run}

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

## 💻 CLI Flags {#cli-flags}

```
Options:
  -c, --config <file>   Path to config file (default: mcp.config.json)
  -t, --tests-dir <dir> Directory containing test files (default: tests)
  -i, --interactive     Run in interactive chat mode
  -h, --help            Show help
```

---

## 🔎 Test Discovery {#test-discovery}

All files ending in `.test.yaml` under the `tests/` directory are executed.
Recursive discovery and full glob patterns are planned for later.

---

## 💬 Interactive Mode {#interactive-mode}

Run the client without tests and chat with your MCP servers:

```bash
test-mcp -i
```

---

## 🛣️ Roadmap {#roadmap}

* [x] Headless MCP client with Anthropic support
* [x] Support for `stdio` transport
* [x] Evaluator for natural-language assertions
* [ ] Support for `http` transport
* [ ] OpenAI support
* [ ] CI-friendly reports
* [ ] Subfolder/glob test discovery

---

## 🤝 Contributing {#contributing}

Contributions, ideas, and bug reports are welcome! See [CONTRIBUTING.md](./.github/CONTRIBUTING.md).

---

## 📄 License {#license}

Apache License 2.0 © [The test-mcp Authors](LICENSE)
