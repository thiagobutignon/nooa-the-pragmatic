# SDK: fix

Run the NOOA fix workflow programmatically.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.fix.run({ issue: "bug", dryRun: true });
```

## API

### `sdk.fix.run(input)`
- `issue?: string`
- `dryRun?: boolean`
- `json?: boolean`

**Returns**
- `SdkResult<ExecuteFixResponse>`

**Errors**
- `fix_error`
