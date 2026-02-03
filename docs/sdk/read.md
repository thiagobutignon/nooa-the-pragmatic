# SDK: read

Read file contents from the local filesystem.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.read.run({ path: "README.md" });
if (result.ok) {
	console.log(result.data.content);
}
```

## API

### `sdk.read.run(input)`

**Input**
- `path?: string`

**Returns**
- `SdkResult<ReadRunResult>`

**ReadRunResult**
- `ok: boolean`
- `traceId: string`
- `path: string`
- `bytes: number`
- `content: string`

**Errors**
- `invalid_input` when path is missing
- `runtime_error` when file read fails
