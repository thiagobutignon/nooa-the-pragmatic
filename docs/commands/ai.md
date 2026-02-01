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
- `-h, --help`: Show the help message.

## How it works

1. **Provider Resolution**: Picks the requested or default provider (defined in environment variables).
2. **Completion**: Sends the prompt to the AI engine.
3. **Output**: Displays the raw text content or JSON metadata if requested.

## Examples

```bash
# Basic query
nooa ai "Who are you?"

# specify provider
nooa ai "Explain TDD" --provider openai

# Get JSON output
nooa ai "Tell a joke" --json
```
