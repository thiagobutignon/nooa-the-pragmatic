# CLI Improvement Suggestions (2026-01-30)

## 1. Global Flag Pollution in `parseArgs`
- **Issue**: All possible flags for all subcommands (e.g., `--regex`, `--overwrite`, `--from`) are currently defined in the root `index.ts`. This makes the root strict parser sensitive to flags that it shouldn't care about until a subcommand is chosen.
- **Recommendation**: Refactor `parseArgs` to a two-step process:
    1. Parse the subcommand and global flags (e.g., `--help`, `--version`, `--json`) with `strict: false`.
    2. Pass the remaining `positionals` and `values` to the subcommand's `execute` method, which can then perform its own strict parsing or validation.

## 2. Command-Specific Help Consistency
- **Issue**: Some subcommands have very detailed help strings, while others are more sparse.
- **Recommendation**: Standardize the help format across all features in `src/features/*/cli.ts`.

## 3. Search Result Formatter
- **Issue**: The plain text search output (`path:line:col:snippet`) is efficient but hard for humans to read.
- **Recommendation**: Add a `--pretty` or interactive mode choice that uses colors to highlight the query match within the snippet.
