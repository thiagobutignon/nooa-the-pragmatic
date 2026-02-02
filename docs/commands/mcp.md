# nooa mcp

Manage Model Context Protocol (MCP) servers from the CLI. MCPs expose deterministic tools over JSON-RPC, and NOOA persists their configuration in SQLite (`nooa.db` by default or via `NOOA_DB_PATH`).

## Usage

```bash
nooa mcp <subcommand> [args]
```

## Shared Flags

- `--json`: Output structured JSON when supported.
- `-h, --help`: Show the help message.
- `NOOA_DB_PATH`: Environment variable that overrides `nooa.db`.

## Subcommands

- `install <package> [name]`: Register a new MCP. Supports npm package names, git URLs, or local paths. Flags:
  - `--command`: Binary to execute (default: `bun`).
  - `--args`: Arguments to pass to the binary (`repeatable`).
  - `--env`: Environment variables for the MCP (`KEY=VALUE`, repeatable).
  - `--force`: Replace an existing MCP with the same name.
  Example: `nooa mcp install @modelcontextprotocol/server-filesystem --command bun --args ./server.cjs`.

- `list`: Show installed/enabled MCPs. Use `--installed` to list them all, `--enabled` to see only enabled entries, and `--json` for machine-readable output.

- `enable <name>` / `disable <name>`: Toggle MCP availability. Use `--json` to emit structured confirmation.

-- `call <mcp> <tool> [--json] [--retries <n>] [--timeout <ms>] [--backoff <ms>] --arg=value...`: Execute a tool exposed by an MCP. Tool arguments are translated into JSON-RPC params. Flags:
  - `--retries`: Number of attempts before giving up (default: 3).
  - `--timeout`: Milliseconds before the MCP call times out (default: 30000).
  - `--backoff`: Initial backoff delay (ms) between retries (doubles each attempt up to 10s, default: 500).
  Examples: `nooa mcp call filesystem read_file --path README.md --retries 5 --timeout 10000`.

- `health <name> [--json]`: Check the given MCP server’s health by starting it, pinging it, and measuring latency. Returns 0 only when the status is `healthy`; `degraded`/`down` exit with code 1. Use `--json` to emit the full health object (status, latency, lastCheck, reason, lastError).
- `resource <mcp> <uri> [--json]`: Read a resource from an MCP server by its URI. Supports `file://`, `schema://`, etc., and emits JSON when `--json` is provided.
- `resource <mcp> <uri> [--json]`: Read a resource from an MCP server by its URI. Supports `file://`, `schema://`, etc., and emits JSON when `--json` is provided.
- `uninstall <name>`: Remove an MCP configuration from the registry.
- `test <name> [--json]`: Ping the MCP server to verify it starts and responds; outputs `ok` (or JSON when requested).
- `init [--skip-github] [--github-token <token>]`: Install the recommended MCPs (filesystem + GitHub) so new users get a working environment quickly. Pass `--skip-github` to skip GitHub or `--github-token` to configure its token. Use `--force` to reinstall even if existing.

- `info <name>`: Describe how an MCP is configured (command, args, env, enabled).

- `configure <name> --args <arg>... --env KEY=VAL --command <cmd> [--enable|--disable]`: Update the stored command, args, env, or enabled toggle for a server.

NOOA persists MCP metadata in SQLite, so all commands read/write the same store. Use `NOOA_DB_PATH` to keep MCP data isolated per project or session.
