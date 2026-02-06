# Workflow Engine

## Purpose

The WorkflowEngine enforces the **Disciplined Hypergrowth Loop** by executing a sequence of gated steps. It is the enforcement layer between the CLI entry points (ex: `nooa act`) and downstream execution (tests, dogfooding, etc.).

The engine is **deterministic**: every step is evaluated in order, each gate either passes or fails, and the run ends on the first failure.

## Core Types

### WorkflowContext

```ts
export interface WorkflowContext {
  traceId: string;
  command: string;
  args: Record<string, unknown>;
  cwd: string;
  worktree?: string;
}
```

### Gate

```ts
export interface GateResult {
  ok: true;
} | {
  ok: false;
  reason: string;
  suggestions?: string[];
};

export interface Gate {
  id: string;
  description: string;
  check(ctx: WorkflowContext): Promise<GateResult>;
}
```

### WorkflowStep

```ts
export interface WorkflowStep {
  id: string;
  gate: Gate;
  action: (ctx: WorkflowContext) => Promise<void>;
}
```

### WorkflowEngine

```ts
export interface WorkflowResult {
  ok: boolean;
  reason?: string;
  failedStep?: string;
}

export class WorkflowEngine {
  async run(steps: WorkflowStep[], ctx: WorkflowContext): Promise<WorkflowResult> {
    for (const step of steps) {
      const gateResult = await step.gate.check(ctx);
      if (!gateResult.ok) {
        return { ok: false, reason: gateResult.reason, failedStep: step.id };
      }
      await step.action(ctx);
    }
    return { ok: true };
  }
}
```

## Gate Order (MVP)

1. **SpecGate**: validates spec presence for the command.
2. **TestGate**: runs tests (or checks prior results).
3. **DogfoodGate**: verifies the command behavior via CLI.

## Observability

Workflow events are emitted through the EventBus and telemetry:

- `workflow.started`
- `workflow.step.start`
- `workflow.gate.pass`
- `workflow.gate.fail`
- `workflow.completed`

Each event must include `traceId` and step/gate identifiers when relevant.

## Failure Semantics

- The first gate failure halts execution.
- The engine returns `{ ok: false }` with `reason` and `failedStep`.
- Callers map the result to CLI exit codes (`1` runtime, `2` validation).

## Extension Points

- Additional gates can be inserted between steps without breaking the engine.
- Future steps may include: `lint`, `format`, `policy`, `snapshot`.

## Minimal Example

```ts
const steps: WorkflowStep[] = [
  { id: "spec", gate: new SpecGate(), action: async () => {} },
  { id: "tests", gate: new TestGate(), action: async () => {} },
  { id: "dogfood", gate: new DogfoodGate(), action: async () => {} },
];

const result = await new WorkflowEngine().run(steps, {
  traceId: "t",
  command: "act",
  args: { goal: "Ship it" },
  cwd: process.cwd(),
});
```
