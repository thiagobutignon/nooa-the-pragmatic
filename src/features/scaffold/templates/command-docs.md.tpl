# {{Command}} Command

{{name}} is a feature designed to [Describe what this feature does].

## Usage
```bash
nooa {{name}} [flags] [args]
```

## Flags
- `--json`: Output results in structured JSON format.
- `--out <file>`: Write results to a specific file.
- `-h, --help`: Show this help message.

## JSON Output Schema
```json
{
  "schemaVersion": "1.0",
  "ok": true,
  "traceId": "string",
  "command": "{{name}}",
  "timestamp": "ISO8601",
  "result": {
    "message": "string"
  }
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
nooa {{name}}

# Exporting JSON result
nooa {{name}} --json --out result.json
```
