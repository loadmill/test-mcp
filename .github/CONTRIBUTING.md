# Contributing to MCP Flow

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Run tests:
   ```bash
   npm test
   ```

## Project Structure

- `src/` - TypeScript source code
- `build/` - Compiled JavaScript output
- `tests/` - YAML test specifications
- `examples/` - Example MCP servers

## Key Components

- **MCPClient** - Core MCP protocol client with namespaced tool routing
- **LLM Interface** - Provider abstraction (Anthropic Claude)
- **Test Runner** - YAML-based test execution with LLM assertion evaluation
- **Logger** - Centralized domain-specific logging with debug gating

## Code Style

- Prefer editing existing files over creating new ones
- Keep logging calls as simple one-liners using domain methods
- Use TypeScript strict mode

## Testing

Tests are written in YAML format with `prompt` and `assert` steps. The test runner uses LLM evaluation to validate assertions against conversation history.

## Debugging

Enable trace mode for detailed request/response logging to JSONL files:
```bash
node build/index.js --trace
```
