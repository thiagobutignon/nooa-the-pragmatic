export type NOOAEvent =
	| { type: "workflow.started"; traceId: string; goal: string }
	| { type: "workflow.step.start"; traceId: string; stepId: string }
	| { type: "workflow.gate.pass"; traceId: string; gateId: string }
	| { type: "workflow.gate.fail"; traceId: string; gateId: string; reason: string }
	| { type: "workflow.completed"; traceId: string; result: "success" | "failure" }
	| { type: "act.started"; traceId: string; goal: string }
	| { type: "act.completed"; traceId: string; goal: string; result: "success" | "failure" }
	| { type: "act.failed"; traceId: string; goal: string; error: string }
	| { type: "test.failed"; traceId: string; test: string; error: string }
	| { type: "commit.created"; traceId: string; hash: string; message: string }
	| { type: "worktree.acquired"; traceId: string; path: string; branch: string }
	| { type: "worktree.released"; traceId: string; path: string }
	| { type: "fix.started"; traceId: string; issue: string }
	| { type: "fix.completed"; traceId: string; issue: string; ok: boolean }
	| { type: "fix.failed"; traceId: string; issue: string; error: string };
