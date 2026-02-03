# SDK: ci

Run the local CI pipeline programmatically.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.ci.run({});
if (result.ok) {
	console.log(result.data.ok);
}
```

## API

### `sdk.ci.run(input)`

**Input**
- `json?: boolean` (included for parity; output is always structured)

**Returns**
- `SdkResult<CiResult>`

**Errors**
- `ci_error` when CI execution fails
