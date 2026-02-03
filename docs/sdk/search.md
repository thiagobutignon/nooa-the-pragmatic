# SDK: search

Search for patterns in files or filenames.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.search.run({
	query: "TODO",
	root: ".",
	maxResults: 50,
});
if (result.ok) {
	console.log(result.data.results);
}
```

## API

### `sdk.search.run(input)`

**Input**
- `query?: string`
- `root?: string`
- `regex?: boolean`
- `caseSensitive?: boolean`
- `filesOnly?: boolean`
- `maxResults?: number`
- `include?: string[]`
- `exclude?: string[]`
- `ignoreCase?: boolean`
- `context?: number`
- `count?: boolean`
- `hidden?: boolean`

**Returns**
- `SdkResult<SearchRunResult>`

**SearchRunResult**
- `results: SearchResult[]`
- `files?: string[]`
- `counts?: Record<string, number>`

**Errors**
- `invalid_input` when query is missing or maxResults is invalid
- `runtime_error` when search fails
