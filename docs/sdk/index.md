# SDK: index

Index code for semantic search and query it.

## Usage

```ts
import { sdk } from "../../src/sdk";

await sdk.index.build({ root: "." });
```

## API

### `sdk.index.build({ root })`
### `sdk.index.file({ fullPath, root })`
### `sdk.index.search({ query, limit })`
### `sdk.index.clear()`
### `sdk.index.stats()`
### `sdk.index.rebuild({ root })`

**Errors**
- `invalid_input`, `index_error`
