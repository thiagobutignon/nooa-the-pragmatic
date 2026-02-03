# SDK: prompt

Manage prompt templates programmatically.

## Usage

```ts
import { sdk } from "../../src/sdk";

await sdk.prompt.create({ name: "alpha", description: "Alpha", body: "Hello" });
```

## API

### `sdk.prompt.create({ templatesDir, name, description, output, body })`
### `sdk.prompt.edit({ templatesDir, name, patch })`
### `sdk.prompt.remove({ templatesDir, name })`
### `sdk.prompt.publish({ templatesDir, name, level, changelogPath, note })`

**Errors**
- `invalid_input`, `prompt_error`
