# SDK: ask

Programmatic access to semantic search over indexed code/memory.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.ask.run({ query: "find login", limit: 5 });
if (result.ok) {
	console.log(result.data);
}
```

## API

### `sdk.ask.run(input)`

**Input**
- `query?: string`
- `limit?: number` (default: 5)

**Returns**
- `SdkResult<AskResult[]>`

**AskResult**
- `path: string`
- `chunk: string`
- `score: number`

**Errors**
- `invalid_input` when query is missing
- `ask_error` when search fails
