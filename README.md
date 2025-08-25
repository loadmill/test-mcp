# 📦 test-mcp

<p align="center">
  <a href="https://www.npmjs.com/package/test-mcp"><img src="https://img.shields.io/npm/v/test-mcp?color=green" alt="npm version"></a>
  <a href="https://discord.gg/ABC"><img src="https://img.shields.io/discord/123?logo=discord&label=discord" alt="Discord"></a>
</p>

---

**`test-mcp`** is the first headless [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) client for automated testing.  
If you’re building an MCP server, test-mcp helps you validate it end-to-end in a fast and repeatable way.

---

## 💡 What's `test-mcp`?

`test-mcp` gives you three core components:

* **Configuration** – define your MCP servers and LLM provider in a single JSON file.
* **Test Files** – write flows of natural-language prompts and assertions in YAML.
* **Runner** – run tests from the CLI, get clear pass/fail results.

Together, these let you automate and validate MCP server behavior with simple, repeatable tests.

---

## 🏗️ Installation

```bash
# using npm
npm install -g test-mcp

# or with pnpm
pnpm add -g test-mcp
````

---

## 🚀 Getting Started

**1. Create a config (`mcp.config.json`)**

```json
{
  "version": "0.1",
  "mcpClient": {
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
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

**2. Write a test (`tests/bank-transaction.test.yaml`)**

```yaml
description: "Maker Checker Bank - Transaction Creation and Rejection Flow"

steps:
  - prompt: "Login with username alice and password alice123 and transfer $100 to Bob"
  - prompt: "Login with username bob and password bob456, reject transaction from Alice"
  - assert: "Validate the transaction was created and rejected successfully"
```

**3. Run**

By default, `test-mcp` will look for a `mcp.config.json` file in your project root and run all test files in the `tests/` folder that match `*.test.yaml`.

```bash
# if installed globally
test-mcp

# if running from source
npm run build
node build/index.js
```

To be explicit, you can point to a specific config or test directory:

```bash
test-mcp --config mcp.config.json --tests-dir ./tests
```

---

## ⚙️ CLI Options

```
Options:
  -c, --config <file>   Path to config file (default: mcp.config.json)
  -t, --tests-dir <dir> Directory containing test files (default: tests)
  -i, --interactive     Run in interactive chat mode
  -h, --help            Show help
```

---

## 🔍 Test Discovery

Currently, `test-mcp` runs all test files ending in `.test.yaml` directly under the `tests/` folder.
Subfolders and full glob patterns (like `**/*.test.yaml`) are planned for future support.

---

## 💬 Interactive Mode

```bash
test-mcp --interactive
```

Interactive mode lets you chat with your MCP servers using the same configuration instead of running tests.

---

## 🛣️ Roadmap

* [x] Headless MCP client with Anthropic support
* [x] Support for `stdio` transport
* [x] Evaluator for natural-language assertions
* [ ] Support for `http` transport
* [ ] OpenAI support
* [ ] CI-friendly reports
* [ ] Subfolder/glob test discovery

---

## 🤝 Contributing

Contributions, ideas, and bug reports are welcome! See [CONTRIBUTING.md](./.github/CONTRIBUTING.md).

---

## 📄 License

Apache License 2.0 © [The test-mcp Authors](LICENSE)
