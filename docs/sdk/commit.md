# SDK: commit

Commit staged changes with validation.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.commit.run({ message: "feat: example", noTest: true });
if (result.ok) {
	console.log(result.data.traceId);
}
```

## API

### `sdk.commit.run(input)`

**Input**
- `message?: string`
- `noTest?: boolean`
- `allowLazy?: boolean`
- `cwd?: string`

**Returns**
- `SdkResult<CommitRunResult>`

**CommitRunResult**
- `ok: boolean`
- `traceId: string`
- `message: string`

**Errors**
- `invalid_input` when message is missing
- `validation_error` when repo state is invalid or policy violations exist
- `runtime_error` when tests or git commit fail
