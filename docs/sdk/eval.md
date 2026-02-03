# SDK: eval

Run evaluation suites and manage evaluation history.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.eval.run({ prompt: "review", suite: "standard" });
```

## API

### `sdk.eval.run(input)`
- `prompt?: string`
- `suite?: string`
- `judge?: "deterministic" | "llm"`
- `failOnRegression?: boolean`

### `sdk.eval.apply(input)`
- `prompt?: string`
- `suite?: string`
- `judge?: "deterministic" | "llm"`
- `bump?: "patch" | "minor" | "major"`
- `failOnRegression?: boolean`

### `sdk.eval.suggest(input)`
- `prompt?: string`
- `suite?: string`
- `judge?: "deterministic" | "llm"`

### `sdk.eval.history(input)`
- `prompt?: string`
- `suite?: string`
- `historyFile?: string`
- `limit?: number`

### `sdk.eval.report(input)`
- `prompt?: string`
- `suite?: string`
- `id?: string`
- `historyFile?: string`

### `sdk.eval.compare(input)`
- `prompt?: string`
- `suite?: string`
- `base?: string`
- `head?: string`
- `historyFile?: string`

**Errors**
- `invalid_input`, `eval_error`, `regression`, `not_found`, `invalid_state`
