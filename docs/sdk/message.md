# SDK: message

Send a message to the agent.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.message.send({ content: "hello", role: "user", json: true });
```

## API

### `sdk.message.send(input)`
- `content?: string`
- `role?: "user" | "system" | "assistant"`
- `json?: boolean`

Returns `SdkResult<{ message, output }>`.

**Errors**
- `invalid_input`, `message_error`
