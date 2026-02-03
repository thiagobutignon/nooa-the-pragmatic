# SDK: pr

Manage GitHub PRs programmatically.

## Usage

```ts
import { sdk } from "../../src/sdk";

await sdk.pr.create({ title: "Title", body: "Body" });
```

## API

### `sdk.pr.create({ title, body, base, head, gh })`
### `sdk.pr.list({ gh })`
### `sdk.pr.merge({ number, method, title, message, gh })`
### `sdk.pr.close({ number, gh })`
### `sdk.pr.comment({ number, body, gh })`
### `sdk.pr.status({ number, gh })`
### `sdk.pr.review({ number, json, gh })`

**Errors**
- `invalid_input`, `pr_error`
