# nooa eval

Systematic evaluation of AI prompts and outputs. This command allows you to test your prompts against predefined suites to ensure quality and prevent regressions.

## Usage

```bash
nooa eval <command> <prompt_name> --suite <name> [flags]
```

## Commands

- `run`: Execute an evaluation suite on a specific prompt.
- `suggest`: Analyze failures from recent runs and suggest prompt improvements.
- `apply`: Automatically bump the prompt version if the evaluation passes.
- `report`: Show the last recorded evaluation entry for a prompt/suite pair.
- `history`: List recent evaluation runs, including id, score, and timestamp.
- `compare`: Diff two history entries (head/base) and highlight the score delta.

## Flags

- `-s, --suite <name>`: The name of the test suite to run (required).
-- `--json`: Output results as a structured JSON object.
-- `--judge <type>`: The type of evaluation judge to use (`deterministic` or `llm`).
-- `--bump <level>`: The version level to increment for `apply` (`patch`, `minor`, `major`).
-- `--limit <n>`: How many history entries to surface when running `history` or `compare` (default 5).
-- `--base <id>` / `--head <id>`: Use explicit history IDs when comparing runs.
-- `--id <id>`: Target a recorded history entry when running `report`.
-- `--fail-on-regression`: Exit with code 1 if the score is lower than previous runs.
-- `-h, --help`: Show the help message.

## How it works

1. **Suite Discovery**: Finds the test suite configuration for the given prompt.
2. **Execution**: Runs the prompt against each test case in the suite.
3. **Scoring**: Calculates a score based on the selected judge's evaluation.
4. **Reporting/History**: Writes a record to `.nooa/eval-history.json` that `report`, `history`, and `compare` read to show progress over time.

## Examples

```bash
# Run the standard review suite
nooa eval run review --suite standard

# Apply changes and bump version
nooa eval apply code --suite smoke --bump minor

# Inspect the last evaluation summary
nooa eval report review --suite standard

# Compare the last two review runs
nooa eval compare review --suite standard
```
