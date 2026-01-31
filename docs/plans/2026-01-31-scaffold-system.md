# Scaffold Command Implementation Plan (NOOA-Grade)

Create a quality-first scaffolding system to ensure new NOOA features and prompts follow project standards (telemetry, JSON envelopes, docs, and testing) by default.

## 1. Objective
Achieve "Hypergrowth" sustainability by automating the creation of standardized feature structures and prompt templates, reducing boilerplate and ensuring cross-feature consistency.

## 2. CLI Contract (`nooa scaffold`)

### `nooa scaffold command <name>`
Creates a new feature directory `src/features/<name>/` with:
- `cli.ts`: Standard entry point with `parseArgs`, `execute` export, and JSON output handling.
- `execute.ts`: Core logic template with `createTraceId` and `telemetry.track`.
- `execute.test.ts`: Unit test setup with `MockProvider` and timeout handling.
- `README.md`: Basic description and usage examples.

### `nooa scaffold prompt <name>`
Creates a new prompt template `src/features/prompt/templates/<name>.md` with:
- Correct YAML frontmatter (version 1.0.0, description, output: json).
- Standard instruction sections: `Golden Rules (No Hallucinations)`, `Strict Categories`, `Evidence Requirement`, `Output (STRICT JSON)`, and `Context`.

## 3. Architecture
- **In-Memory Templates**: The command logic will contain the standard NOOA boilerplate as string templates.
- **Smart Directory Selection**: Detects repository root and writes to `src/features/` or `src/features/prompt/templates/`.
- **Dynamic Registration**: Since `registry.ts` uses an auto-loader, newly scaffolded features will be available in `index.ts help` immediately after creation.

## 4. Implementation Steps
1. **Directory Structure**: Create `src/features/scaffold/`.
2. **Templates**: Define the "The Pragmatic" standard boilerplates for `cli.ts`, `execute.ts`, etc.
3. **Engine**: Implement `scaffoldCommand(name)` and `scaffoldPrompt(name)`.
4. **CLI**: Register `scaffold` as a first-class feature.
5. **Self-Scaffold**: Use the tool to generate its own missing parts (if any) or a test feature.

## 5. Verification
- Run `nooa scaffold command testpkg`.
- Verify `src/features/testpkg/` exists with all files.
- Run `bun index.ts help` and check if `testpkg` is listed.
- Run `nooa scaffold prompt testprompt`.
- Verify `src/features/prompt/templates/testprompt.md` exists and is parseable by `PromptEngine`.
