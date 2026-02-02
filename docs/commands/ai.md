# nooa ai

Directly query the AI engine with a text prompt. This is useful for testing providers, models, or getting quick answers without the overhead of semantic search or task management.

## Usage

```bash
nooa ai <prompt> [flags]
```

## Arguments

- `<prompt>`: The prompt text you want to send to the AI (required).

## Flags

- `--provider <name>`: Specify the AI provider to use. Defaults to `ollama` with a fallback to `openai`.
- `--model <name>`: Override the default model name for the selected provider.
- `--json`: Output the AI response as a structured JSON object.
- `--mcp-source <name>` / `--mcp-tool <name>`: Execute a tool from an enabled MCP server instead of hitting the LLM. Provide the MCP name and tool name.
- `--mcp-args <json>`: JSON payload to pass to the selected MCP tool.
- `-h, --help`: Show the help message.

## How it works

1. **Provider Resolution**: Picks the requested or default provider (defined in environment variables).
2. **Completion**: Sends the prompt to the AI engine.
3. **Output**: Displays the raw text content or JSON metadata if requested.

When MCP flags are supplied, NOOA executes the requested tool via JSON-RPC instead of forwarding the prompt to an LLM. That way you can treat MCPs as deterministic function calls from the CLI.

## Examples

```bash
# Basic query
nooa ai "Who are you?"

# specify provider
nooa ai "Explain TDD" --provider openai

# Get JSON output
nooa ai "Tell a joke" --json

# Run an MCP tool instead of the LLM
nooa ai "unused" --mcp-source mock --mcp-tool echo --mcp-args '{"message":"hi"}' --json
```
