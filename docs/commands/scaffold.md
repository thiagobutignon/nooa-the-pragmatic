# nooa scaffold

Standardize the creation of new features or system components by generating boilerplate code, tests, and configurations.

## Usage

```bash
nooa scaffold <type> <name> [flags]
```

## Arguments

- `<type>`: The type of component to scaffold (e.g., `command`, `prompt`).
- `<name>`: The name of the new component.

## Flags

- `-h, --help`: Show help message.

## How it works

Scaffold looks into `src/features/scaffold/templates` and applies the designated boilerplate. For a `command`, it generates:
- `cli.ts`: The entry point.
- `execute.ts`: The core logic.
- `cli.test.ts`: Integration tests.
- `execute.test.ts`: Unit tests.

## Examples

```bash
nooa scaffold command my-new-feature
```
