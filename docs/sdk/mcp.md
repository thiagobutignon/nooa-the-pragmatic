# SDK: mcp

Manage MCP servers programmatically.

## Usage

```ts
import { sdk } from "../../src/sdk";

await sdk.mcp.install({ package: "@modelcontextprotocol/server-filesystem", name: "filesystem" });
```

## API

### `sdk.mcp.list({ installed, enabled })`
### `sdk.mcp.install({ package, name, command, args, env, force })`
### `sdk.mcp.uninstall({ name })`
### `sdk.mcp.enable({ name })`
### `sdk.mcp.disable({ name })`
### `sdk.mcp.info({ name })`
### `sdk.mcp.call({ name, tool, args, retries, timeout, backoff })`
### `sdk.mcp.resource({ name, uri })`
### `sdk.mcp.health({ name })`
### `sdk.mcp.test({ name })`
### `sdk.mcp.configure({ name, command, args, env, envFile, enable, disable })`
### `sdk.mcp.alias.create({ name, command, args, env, description })`
### `sdk.mcp.alias.list()`
### `sdk.mcp.alias.delete({ name })`
### `sdk.mcp.marketplace({ query, libraryName, verifiedOnly, limit, apiKey, fetchFn })`

**Errors**
- `invalid_input`, `validation_error`, `not_found`, `mcp_error`
