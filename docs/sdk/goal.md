# SDK: goal

Manage the current project goal.

## Usage

```ts
import { sdk } from "../../src/sdk";

await sdk.goal.set({ goal: "Ship SDK" });
```

## API

### `sdk.goal.set(input)`
- `goal?: string`
- `cwd?: string`

### `sdk.goal.get(input)`
- `cwd?: string`

### `sdk.goal.clear(input)`
- `cwd?: string`

**Errors**
- `invalid_input`, `goal_error`
