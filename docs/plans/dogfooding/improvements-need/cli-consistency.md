# Improvement Needs: CLI Help & Consistency

During the dogfooding session on 2026-01-30, the following improvements were identified to enhance UX and consistency across subcommands.

## 1. Help Text Consistency
- **Header Alignment**: Ensure all subcommands use consistent headers: `Usage`, `Arguments`, `Flags`, `Examples`.
- **Usage Line**: Every command should clearly show its positionals in the first line (e.g., `nooa read <path>` vs `nooa read`).
- **Help Alignment**: The dynamic help padding (`25` chars) is good, but we should ensure all descriptions are concise enough to fit without wrapping in standard terminals.

## 2. Dynamic Help Sorting
- **Alphabetical Order**: Currently, `index.ts` lists subcommands in the order they are loaded from the filesystem. Sorting them alphabetically in `registry.list()` or in `index.ts` would make the root help more predictable.

## 3. Exit Codes Documentation
- **Consistency**: Document exit codes for all commands in their respective help text (e.g., 0 for success, 1 for runtime error, 2 for validation error).

## 4. Telemetry Clarity
- **Metadata**: Some commands (like `read`) log the path, while others (like `search`) log many more flags. Standardizing the "essential" metadata for each category of command would improve observability.
