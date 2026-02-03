# SDK: embed

Generate embeddings for text or file contents.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.embed.text({ text: "hello" });
```

## API

### `sdk.embed.text(input)`
- `text?: string`
- `provider?: string`
- `model?: string`
- `endpoint?: string`
- `apiKey?: string`

### `sdk.embed.file(input)`
- `path?: string`
- `provider?: string`
- `model?: string`
- `endpoint?: string`
- `apiKey?: string`

**Returns**
- `SdkResult<EmbedResult>`

**Errors**
- `invalid_input`, `embed_error`
