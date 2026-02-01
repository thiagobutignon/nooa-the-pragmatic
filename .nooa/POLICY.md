# NOOA PROJECT POLICY

## 1. Zero-Preguiça (Zero-Lazy)
We do not ship incomplete intentions. Every commit must represent a finished thought or a functional increment.

- **Rule: no-todo**
  - **Status**: BLOCKING
  - **Description**: `// TODO` markers are forbidden. If a task is pending, it must be tracked in the project's task management system (e.g., `task.md`), not in code.
  
- **Rule: no-mock**
  - **Status**: BLOCKING
  - **Description**: `// MOCK` markers are forbidden. Real or contract-passing implementations are required. If a service is unavailable, it must be properly abstracted/stubbed with a verified interface.

- **Rule: no-fixme**
  - **Status**: BLOCKING
  - **Description**: `// FIXME` markers are forbidden. Fix it now. If it's a known bug, track it as a bug.

## 2. Infrastructure Standards
- All material changes must emit `telemetry` events via the `EventBus`.
- Commands must support `--json` output for high-speed interoperability.
- Code must be documented in `docs/` and verified with `v-` trace IDs.

## 3. Communication
- Be direct. Be surgical. Be NOOA.
