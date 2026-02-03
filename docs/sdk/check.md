# SDK: check

Programmatic access to policy and guardrail checks.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.check.run({ paths: ["src/index.ts"] });
if (result.ok && result.data.type === "policy") {
	console.log(result.data.result.ok);
}
```

## API

### `sdk.check.run(input)`

**Input**
- `paths?: string[]` explicit file or directory paths
- `path?: string` single path to scan (default: `.`)
- `staged?: boolean` use git staged files
- `profile?: string` path to guardrail YAML profile (uses guardrail engine)

**Returns**
- `SdkResult<CheckRunResult>`

**CheckRunResult**
- `{ type: "policy", result: PolicyResult }`
- `{ type: "guardrail", report: GuardrailReport }`

**Errors**
- `check_error` when policy check fails
- `guardrail_error` when guardrail check fails
