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

## Flags

- `-s, --suite <name>`: The name of the test suite to run (required).
- `--json`: Output results as a structured JSON object.
- `--judge <type>`: The type of evaluation judge to use (`deterministic` or `llm`).
- `--bump <level>`: The version level to increment for `apply` (`patch`, `minor`, `major`).
- `--fail-on-regression`: Exit with code 1 if the score is lower than previous runs.
- `-h, --help`: Show the help message.

## How it works

1. **Suite Discovery**: Finds the test suite configuration for the given prompt.
2. **Execution**: Runs the prompt against each test case in the suite.
3. **Scoring**: Calculates a score based on the selected judge's evaluation.
4. **Reporting**: Provides a breakdown of passes/failures and overall score.

## Examples

```bash
# Run the standard review suite
nooa eval run review --suite standard

# Apply changes and bump version
nooa eval apply code --suite smoke --bump minor
```
