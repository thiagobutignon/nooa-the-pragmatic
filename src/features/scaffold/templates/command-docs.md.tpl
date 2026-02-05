# {{Command}} Command

{{name}} is a feature designed to [Describe what this feature does].

## Usage
```bash
nooa {{name}} <input> [flags]
```

## Flags
- `--json`: Output results in structured JSON format.
- `-h, --help`: Show this help message.

## JSON Output Schema
```json
{
  "ok": true,
  "traceId": "string",
  "message": "string"
}
```

## Exit Codes
- `0`: Success.
- `1`: Runtime error (Logic, IO).
- `2`: Validation error (Invalid flags/arguments).

## Telemetry
This command tracks:
- `{{name}}.success`: Triggered on successful execution.
- `{{name}}.failure`: Triggered on error.

## Examples
```bash
# Basic usage
nooa {{name}} hello

# JSON output
nooa {{name}} hello --json
```
