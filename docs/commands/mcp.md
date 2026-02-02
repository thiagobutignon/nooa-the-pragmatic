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

- `init [flags]`: Run the onboarding wizard for the recommended MCPs (filesystem + GitHub). It prompts you for each candidate and, when GitHub is available, asks for a Personal Access Token (or accepts `--github-token`). Flags:
  - `--force`: Reinstall installations even if already configured.
  - `--skip-github`: Skip the GitHub MCP.
  - `--github-token <token>`: Supply the PAT without prompts.
  - `--non-interactive`: Disable prompts (good for automation).
  - `--json`: Emit onboarding results as JSON.
  Example: `nooa mcp init --non-interactive --github-token ghp_xxx`.

- `marketplace <query>`: Discover MCP packages via Context7’s marketplace API (requires a Context7 API key through `CONTEXT7_API_KEY` or `--api-key`). Flags:
  - `--library-name <name>`: Restrict the search to a specific library scope.
  - `--verified-only`: Show only curated/verified entries.
  - `--limit <n>`: How many entries to print (default: 10).
  - `--json`: Emit the raw JSON payload.
  Example: `nooa mcp marketplace search --verified-only --limit 5`.

- `install <package> [name]`: Register a new MCP from npm, git, or disk paths. Flags:
  - `--command <cmd>`: Binary to execute (`bun` by default).
  - `--args <arg>`: Arguments for the MCP binary (repeatable).
  - `--env KEY=VAL`: Environment variables (`repeatable`).
  - `--force`: Replace an existing MCP configuration.
  Example: `nooa mcp install @modelcontextprotocol/server-filesystem --args ./server.cjs`.

- `list`: Show installed/enabled MCPs. Use `--installed`/`--enabled` to filter and `--json` for machine-readable output.

- `enable <name>` / `disable <name>`: Toggle MCP availability (with optional JSON confirmation).

- `call <mcp> <tool> [--json] [--retries <n>] [--timeout <ms>] [--backoff <ms>] --arg=value...`: Execute a tool exposed by an MCP. Tool arguments become JSON-RPC params. Flags:
  - `--retries`: Attempts before giving up (default: 3).
  - `--timeout`: Timeout in milliseconds (default: 30000).
  - `--backoff`: Initial backoff delay (ms) between retries (doubles up to 10s, default: 500).
  Example: `nooa mcp call filesystem read_file --path README.md --retries 5 --timeout 10000`.

- `health <name> [--json]`: Start the MCP, ping it, and report latency/status. Exits 0 only if the status is `healthy`; `degraded`/`down` return 1. Use `--json` for the diagnostic object (status, latency, lastCheck, reason, lastError).

- `resource <mcp> <uri> [--json]`: Read an MCP resource by `file://`, `schema://`, etc., URI. Emits JSON when requested.

- `configure <name>`: Update an MCP’s command, arguments, env, or enabled flag (`--args`, `--env KEY=VALUE`, `--command <cmd>`, `--enable`, `--disable`). By default the command loads shared secrets from `NOOA_MCP_GLOBAL_ENV_FILE` (or `~/.nooa/mcp.env`), then falls back to `.mcp.env` at the repository root, and finally merges any `--env-file` paths you pass (those are resolved relative to the repo root).

- `info <name>`: Describe the stored configuration (command, args, env, enabled timestamp).

- `test <name> [--json]`: Start and ping the MCP, printing `ok`/`failed` or JSON.

- `uninstall <name>`: Remove an MCP configuration completely.

NOOA persists MCP metadata in SQLite, so every command reads/writes the same store. Use `NOOA_DB_PATH` to isolate MCP sets per project or agent session.
