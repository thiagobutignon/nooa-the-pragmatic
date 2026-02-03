# SDK: scaffold

Generate scaffolding for new commands or prompts.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.scaffold.run({
	type: "command",
	name: "auth",
	dryRun: true,
	withDocs: true,
});
if (result.ok) {
	console.log(result.data.files);
}
```

## API

### `sdk.scaffold.run(input)`

**Input**
- `type?: "command" | "prompt"`
- `name?: string`
- `force?: boolean`
- `dryRun?: boolean`
- `withDocs?: boolean`
- `cwd?: string`

**Returns**
- `SdkResult<ScaffoldRunResult>`

**ScaffoldRunResult**
- `ok: boolean`
- `traceId: string`
- `kind: "command" | "prompt"`
- `name: string`
- `files: string[]`
- `dryRun: boolean`

**Errors**
- `invalid_input` when required fields are missing or invalid
- `validation_error` for invalid names or existing files
- `runtime_error` for scaffold failures
