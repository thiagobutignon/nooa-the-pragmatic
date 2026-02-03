# SDK: init

Initialize the .nooa workspace files.

## Usage

```ts
import { sdk } from "../../src/sdk";

await sdk.init.run({ root: ".", name: "NOOA" });
```

## API

### `sdk.init.run(input)`

Same options as CLI init:
- `name?: string`
- `vibe?: string`
- `creature?: string`
- `userName?: string`
- `root?: string`
- `force?: boolean`
- `dryRun?: boolean`

**Errors**
- `init_error`
