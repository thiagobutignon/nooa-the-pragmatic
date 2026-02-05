# TUI State Machine

The TUI is a passive observer of the system state using the Event Bus.
It derives state *solely* from the stream of `NOOAEvent`s.

## States

```typescript
type TUIState =
  | { mode: "idle" }
  | { mode: "running"; workers: WorkerView[] }
  | { mode: "paused"; reason: string }
  | { mode: "error"; error: string };

interface WorkerView {
  id: string; // traceId of the worker
  branch: string;
  goal: string;
  currentStep?: string;
  lastGate?: { id: string; status: "pass" | "fail" };
  lastEventTime: number;
}
```

## Transitions

### Idle -> Running
- **Trigger**: `workflow.started` event received.
- **Action**: Initialize `WorkerView` for the traceId.

### Running -> Update
- **Trigger**: `workflow.step.start`
- **Action**: Update `currentStep`.
- **Trigger**: `workflow.gate.pass` / `fail`
- **Action**: Update `lastGate`.

### Running -> Idle (or Cleanup)
- **Trigger**: `workflow.completed`
- **Action**: Mark worker as done. Remove after N seconds.

## Visual Components

1. **Header**: System status (Online/Offline), Active Workers count.
2. **Worker List**: Card per active worker showing:
   - Branch Name
   - Current Step name
   - Gate status icons (✅ / ❌ / ⏳)
3. **Log Stream (Bottom)**: Rolling tail of raw events (debug mode).
