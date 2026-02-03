# SDK: skills

Manage NOOA skills stored in `.agent/skills`.

## Usage

```ts
import { sdk } from "../../src/sdk";

await sdk.skills.add({ name: "my-skill", description: "Example" });
const list = await sdk.skills.list();
if (list.ok) {
	console.log(list.data);
}
```

## API

### `sdk.skills.list(input?)`

**Input**
- `rootDir?: string`
- `cwd?: string`

**Returns**
- `SdkResult<Skill[]>`

### `sdk.skills.add(input)`

**Input**
- `name?: string`
- `description?: string`
- `rootDir?: string`
- `cwd?: string`

**Returns**
- `SdkResult<{ ok: boolean; name: string }>`

### `sdk.skills.remove(input)`

**Input**
- `name?: string`
- `rootDir?: string`
- `cwd?: string`

### `sdk.skills.show(input)`

**Input**
- `name?: string`
- `rootDir?: string`
- `cwd?: string`

**Returns**
- `SdkResult<{ name: string; description: string; content: string }>`

### `sdk.skills.enable(input)` / `sdk.skills.disable(input)` / `sdk.skills.update(input)`

**Input**
- `name?: string`
- `rootDir?: string`
- `cwd?: string`

**Errors**
- `invalid_input` when name is missing
- `runtime_error` on manager failures
