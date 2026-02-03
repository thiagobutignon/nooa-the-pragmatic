# SDK: review

Run an AI-powered review on a file, staged diff, or provided diff.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.review.run({ path: "src/index.ts", json: true });
if (result.ok) {
	console.log(result.data.result);
}
```

## API

### `sdk.review.run(input)`

**Input**
- `path?: string`
- `staged?: boolean`
- `diff?: string`
- `json?: boolean`
- `prompt?: string`
- `failOn?: "low" | "medium" | "high"`

**Returns**
- `SdkResult<ReviewRunResult>`

**ReviewRunResult**
- `ok: boolean`
- `traceId: string`
- `content: string`
- `result?: ReviewResult`

**Errors**
- `invalid_input` when no input is provided or severity is invalid
- `review_parse` when JSON parsing fails
- `review_fail_on` when findings exceed the threshold
- `runtime_error` when review execution fails
