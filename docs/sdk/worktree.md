# SDK: worktree

Manage git worktrees via the same logic used by the CLI.

## Usage

```ts
import { sdk } from "../../src/sdk";

const created = await sdk.worktree.create({
	branch: "feat/example",
	base: "main",
	noInstall: true,
	noTest: true,
});
if (created.ok) {
	console.log(created.data.path);
}
```

## API

### `sdk.worktree.create(input)`

**Input**
- `branch?: string`
- `base?: string`
- `noInstall?: boolean`
- `noTest?: boolean`
- `cwd?: string`

**Returns**
- `SdkResult<WorktreeCreateResult>`

### `sdk.worktree.list(input?)`

**Input**
- `cwd?: string`

**Returns**
- `SdkResult<WorktreeListResult>`

### `sdk.worktree.info(input)` / `sdk.worktree.remove(input)` / `sdk.worktree.lock(input)` / `sdk.worktree.unlock(input)`

**Input**
- `branch?: string`
- `cwd?: string`

### `sdk.worktree.prune(input?)`

**Input**
- `cwd?: string`

**Errors**
- `validation_error` for invalid inputs or missing repo
- `runtime_error` for git/install/test failures
