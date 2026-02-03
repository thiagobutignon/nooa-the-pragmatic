# SDK: context

Build context around a file or symbol.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.context.build({ target: "src/index.ts" });
if (result.ok) {
	console.log(result.data.related);
}
```

## API

### `sdk.context.build(input)`

**Input**
- `target?: string`

**Returns**
- `SdkResult<ContextResult>`

**Errors**
- `invalid_input` when target is missing
- `context_error` when context building fails
