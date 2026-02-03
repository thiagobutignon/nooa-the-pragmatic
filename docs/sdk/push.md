# SDK: push

Push committed changes to a remote repository with policy and test checks.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.push.run({
	remote: "origin",
	branch: "main",
	noTest: true,
});
if (result.ok) {
	console.log(result.data.traceId);
}
```

## API

### `sdk.push.run(input)`

**Input**
- `remote?: string`
- `branch?: string`
- `noTest?: boolean`
- `cwd?: string`

**Returns**
- `SdkResult<PushRunResult>`

**PushRunResult**
- `ok: boolean`
- `traceId: string`
- `message: string`

**Errors**
- `validation_error` when repo state is invalid or policy violations exist
- `runtime_error` when tests or git push fail
