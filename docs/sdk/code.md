# SDK: code

Programmatic access to code operations: write, patch, diff, format, refactor.

## Usage

```ts
import { sdk } from "../../src/sdk";

await sdk.code.write({ path: "file.ts", content: "hi", overwrite: false, dryRun: false });
```

## API

### `sdk.code.write(input)`
- `path: string`
- `content: string`
- `overwrite: boolean`
- `dryRun: boolean`

Returns `SdkResult<WriteCodeResult>`.

### `sdk.code.patch(input)`
- `path: string`
- `patch: string`
- `dryRun?: boolean`

Returns `SdkResult<CodePatchResult>`.

### `sdk.code.diff(input)`
- `path?: string`

Returns `SdkResult<string>`.

### `sdk.code.format(input)`
- `path: string`

Returns `SdkResult<string>`.

### `sdk.code.refactor(input)`
- `path: string`
- `instructions: string`
- `engine?: Pick<AiEngine, "complete">`

Returns `SdkResult<string>`.

**Errors**
- `code_write_error`, `code_patch_error`, `code_diff_error`, `code_format_error`, `code_refactor_error`
