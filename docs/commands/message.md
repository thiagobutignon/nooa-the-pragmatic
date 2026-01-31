# nooa message

Send a message to the AI agent.

## Usage

```bash
nooa message <text> [flags]
```

## Arguments

- `<text>` - The message content (required)

## Flags

- `--role <type>` - Message role: `user`, `system`, or `assistant` (default: `user`)
- `--json` - Output result in JSON format
- `-h, --help` - Show help message

## Examples

### Basic message
```bash
nooa message "Hello, how are you?"
# Output: [user] Hello, how are you?
```

### System message
```bash
nooa message "Initialize system" --role system
# Output: [system] Initialize system
```

### JSON output
```bash
nooa message "Summarize this" --json
# Output:
# {
#   "role": "user",
#   "content": "Summarize this",
#   "timestamp": "2025-01-30T12:34:56.789Z"
# }
```

## Exit Codes

- `0` - Success
- `1` - Runtime Error (failed execution)
- `2` - Validation Error (missing text or invalid role)

## Message Roles

- **user** (default): Messages from the end user
- **system**: System-level instructions or context
- **assistant**: Messages from the AI (for testing or replay)

## Output Format

### Plain Text (default)
```
[role] message content
```

### JSON (--json flag)
```json
{
  "role": "user",
  "content": "message content",
  "timestamp": "ISO 8601 timestamp"
}
```

## Notes

- This command currently logs messages to telemetry only
- AI backend integration will be added in future releases
- Messages are not persisted between commands (yet)

## Troubleshooting

### "Message text is required"
You must provide message text as an argument:
```bash
nooa message "your text here"
```

### "Invalid role"
Role must be one of: `user`, `system`, `assistant`
```bash
nooa message "test" --role user  # ✓ valid
nooa message "test" --role admin # ✗ invalid
```
