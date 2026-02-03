# SDK: cron

Manage recurring jobs programmatically.

## Usage

```ts
import { sdk } from "../../src/sdk";

await sdk.cron.add({ name: "daily", schedule: "0 2 * * *", command: "index repo" });
```

## API

### `sdk.cron.add(input)`
- `name?: string`
- `schedule?: string`
- `command?: string`
- `description?: string`
- `onFailure?: "notify" | "retry" | "ignore"`
- `retries?: number`
- `timeout?: string`
- `startAt?: string`
- `endAt?: string`
- `maxRuns?: number`

### `sdk.cron.list(input)`
- `active?: boolean`

### `sdk.cron.status(input)` / `enable` / `disable` / `pause` / `resume`
- `name?: string`

### `sdk.cron.remove(input)`
- `name?: string`
- `force?: boolean`

### `sdk.cron.run(input)`
- `name?: string`

### `sdk.cron.logs(input)` / `history`
- `name?: string`
- `limit?: number`
- `since?: string`

### `sdk.cron.edit(input)`
- `name?: string`
- `schedule?: string`
- `command?: string`
- `description?: string`

**Errors**
- `invalid_input`, `not_found`, `cron_error`, `runtime_error`
