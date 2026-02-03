# SDK: ai

Programmatic access to the AI engine and MCP tool execution.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.ai.run({ prompt: "hello", provider: "mock" });
if (result.ok) {
	if (result.data.type === "completion") {
		console.log(result.data.response.content);
	}
}
```

## API

### `sdk.ai.run(input)`

Runs either:
- an AI completion when `prompt` is provided, or
- an MCP tool when `mcpSource` and `mcpTool` are provided.

**Input**
- `prompt?: string`
- `provider?: string`
- `model?: string`
- `mcpSource?: string`
- `mcpTool?: string`
- `mcpArgs?: Record<string, unknown>`

**Returns**
- `SdkResult<AiRunResult>`

**AiRunResult**
- `{ type: "completion", response: AiResponse }`
- `{ type: "mcp", server: string, tool: string, result: unknown }`

**Errors**
- `invalid_input` when required fields are missing
- `mcp_error` when MCP tool execution fails
- `ai_error` when AI completion fails
