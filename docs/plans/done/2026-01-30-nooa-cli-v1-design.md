# NOOA CLI v1 Design (0.0.1)

Date: 2026-01-30
Owner: NOOA The Pragmatic / Thiago Butignon
Status: Approved

## Summary

Unify the existing CLI into a single binary named `nooa`. Absorb useful behavior from `resume2md` into `nooa resume`, while keeping `nooa jobs` and `nooa bridge`. The CLI contract is human-first with `--json` for automation. This v0.0.1 release is tagged for rollback safety.

## Goals

- Single CLI entrypoint: `nooa` only.
- Stable CLI contract: help as spec, stdout vs stderr discipline, exit codes.
- Preserve existing functionality (resume conversion, jobs, bridge) via subcommands.
- Internal event-driven decoupling between CLI handlers and core logic.
- Version v0.0.1 and git tag for rollback.

## Non-Goals

- External pub/sub or persistence for events.
- New features beyond existing resume/jobs/bridge capabilities.

## CLI Contract

- Root: `nooa [global flags] <subcommand> [args]`
- Global flags: `-h/--help`, `--version`, `--json`, `-q/--quiet`, `-v/--verbose` (if used)
- Output: stdout for data; stderr for diagnostics.
- Interactivity: none by default. If prompts exist in future, add `--no-input`.
- Exit codes: `0` success, `1` failure, `2` invalid usage.

## Command Tree (v0.0.1)

- `nooa resume <convert|to-pdf|to-json-resume|from-json-resume|validate> ...`
  - Absorb flags from current `resume2md`:
    - `--output`, `--to-pdf`, `--json`, `--to-json-resume`, `--from-json-resume`
    - `--linkedin`, `--github`, `--whatsapp`, `--validate`
- `nooa jobs <search|list|apply|cron> ...`
  - Keep existing jobs flows and flags: `--search`, `--provider`, `--list`, `--apply`, `--cron`
- `nooa bridge <spec> [--op <id>] [--param k=v] [--header k:v] [--list]`

## Events (In-Process)

Introduce a lightweight event bus used by CLI handlers:

- `resume.converted`, `resume.validated`
- `jobs.matched`, `jobs.saved`, `jobs.applied`
- `bridge.executed`
- `cli.error`

Payload schema (minimum):

```json
{ "timestamp": "...", "command": "...", "status": "ok|error", "durationMs": 0, "metadata": { ... } }
```

Errors include `error.code`, `error.message`, and contextual metadata.

## Error Handling

- No stack traces by default.
- Clear, actionable stderr messages.
- Usage errors show help and return exit code 2.
- All errors emit `cli.error` event.

## Testing

- CLI tests invoke `nooa` via `bun` + `execa`.
- For each subcommand: one happy path + one failure path.
- When `--json` is used, validate JSON schema shape.
- Unit tests for EventBus: subscribe/unsubscribe/publish order.

## Versioning & Release

- Set version to `0.0.1`.
- Tag `v0.0.1` to allow rollback.

## Risks

- Contract churn: mitigate by making help text the spec and testing CLI output.
- Coupling: mitigate via EventBus boundary and thin CLI handlers.

