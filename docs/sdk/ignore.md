# SDK: ignore

Manage .nooa-ignore patterns programmatically.

## Usage

```ts
import { sdk } from "../../src/sdk";

await sdk.ignore.add({ pattern: "**/*.ts" });
```

## API

### `sdk.ignore.list({ cwd })`
### `sdk.ignore.add({ pattern, cwd })`
### `sdk.ignore.remove({ pattern, cwd })`
### `sdk.ignore.check({ path, cwd })`
### `sdk.ignore.test({ pattern, value, cwd })`
### `sdk.ignore.save({ patterns, cwd })`

**Errors**
- `invalid_input`, `ignore_error`
