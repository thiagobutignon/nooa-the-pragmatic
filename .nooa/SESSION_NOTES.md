# Session Notes

- **2026-02-02** — Identified that many CLI tests broke because `execa` calls were inheriting the wrong `PATH`/`stdio`; stable `bunPath` + `baseEnv` helpers keep help/commands returning exit codes properly, so future work should reuse those helpers before writing new CLI tests.  
- Always run the full verification set (`bun test`, `bun check`, `bun linter`) before claiming success and mention the command outputs explicitly; it avoids false confidence and responds to the verification-before-completion rule.  
- Root-cause every regression with the systematic-debugging workflow (phases 1–4) rather than guessing; this session reinforced that the best fix is one that proves itself on fresh failing tests or telemetry.
