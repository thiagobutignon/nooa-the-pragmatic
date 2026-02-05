# Canonical Event Schema

This document defines the exhaustive list of events emitted by the NOOA Agentic System.
All events must adhere to the `NOOAEvent` discriminated union type.

## Type Definition

```typescript
export type NOOAEvent =
  // Workflow Lifecycle
  | { type: "workflow.started"; traceId: string; goal: string }
  | { type: "workflow.step.start"; traceId: string; stepId: string }
  | { type: "workflow.gate.pass"; traceId: string; gateId: string }
  | { type: "workflow.gate.fail"; traceId: string; gateId: string; reason: string }
  | { type: "workflow.completed"; traceId: string; result: "success" | "failure" }
  
  // Execution Events (Legacy & Core)
  | { type: "act.started"; traceId: string; goal: string }
  | { type: "act.completed"; traceId: string; result: unknown }
  | { type: "test.failed"; traceId: string; test: string; error: string }
  | { type: "commit.created"; traceId: string; hash: string; message: string }
  
  // Resource Events
  | { type: "worktree.acquired"; traceId: string; path: string; branch: string }
  | { type: "worktree.released"; traceId: string; path: string };
```

## Usage Guidelines

### Emission
Events should be emitted **only** via `eventBus.emit<NOOAEvent>(event)`.

### Timing
- **Action Events**: Emit `*.started` before execution, `*.completed` after.
- **CLI Commands**: Emit events *after* standard output (stdout/stderr) is flushed to preserve CLI contracts.

### Payload Standards
- `traceId`: **Mandatory**. Must propagate from the command entry point.
- `reason`: **Mandatory for failures**. Must be human-readable.
