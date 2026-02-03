# SDK: guardrail

Run guardrail checks and manage profiles/specs.

## Usage

```ts
import { sdk } from "../../src/sdk";

const list = await sdk.guardrail.list();
```

## API

### `sdk.guardrail.check(input)`
- `profile?: string`
- `spec?: boolean`
- `cwd?: string`

### `sdk.guardrail.validate(input)`
- `profile?: string`

### `sdk.guardrail.init(input)`
- `cwd?: string`

### `sdk.guardrail.list()`

### `sdk.guardrail.show({ name })`

### `sdk.guardrail.add({ name, cwd })`

### `sdk.guardrail.remove({ name, force, cwd })`

### `sdk.guardrail.spec.show/init/validate({ cwd })`

**Errors**
- `invalid_input`, `validation_error`, `guardrail_error`, `not_found`
