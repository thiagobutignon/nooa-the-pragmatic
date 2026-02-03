# SDK: memory

Manage NOOA persistent memory entries.

## Usage

```ts
import { sdk } from "../../src/sdk";

await sdk.memory.add({ content: "Remember this", type: "fact" });
const list = await sdk.memory.list();
if (list.ok) {
	console.log(list.data.entries.length);
}
```

## API

### `sdk.memory.add(input)`

**Input**
- `content?: string`
- `type?: MemoryType`
- `scope?: MemoryScope`
- `confidence?: MemoryConfidence`
- `tags?: string[]`
- `traceId?: string`
- `cwd?: string`

### `sdk.memory.search(input)` / `sdk.memory.list(input?)`

**Input**
- `query?: string` (search only)
- `semantic?: boolean` (search only)
- `cwd?: string`

**Returns**
- `SdkResult<{ entries: MemoryEntry[] }>`

### `sdk.memory.get(input)` / `sdk.memory.remove(input)` / `sdk.memory.promote(input)`

**Input**
- `id?: string`
- `cwd?: string`

### `sdk.memory.update(input)`

**Input**
- `id?: string`
- `content?: string`
- `cwd?: string`

### `sdk.memory.clear(input?)`

**Input**
- `force?: boolean`
- `cwd?: string`

### `sdk.memory.export(input)` / `sdk.memory.import(input)`

**Input**
- `path?: string`
- `cwd?: string`

### `sdk.memory.summarize(input?)`

**Input**
- `cwd?: string`

**Errors**
- `invalid_input` for missing required fields
- `validation_error` for unsafe clear without force
- `runtime_error` for execution failures
