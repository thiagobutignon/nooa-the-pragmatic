# NOOA SDK

The NOOA SDK provides a programmatic interface to all CLI commands.

## Modules

Each CLI command has a corresponding SDK module in `src/sdk/<command>.ts` and
documentation in `docs/sdk/<command>.md`.

## Usage (Example)

```ts
import { sdk } from "../src/sdk";

const result = await sdk.guardrail.check({ profile: "security" });
if (result.ok) {
  console.log(result.data);
}
```
