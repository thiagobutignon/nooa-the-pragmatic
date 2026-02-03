import { describe, expect, it } from "bun:test";
import { sdk } from "./index";

describe("SDK surface", () => {
	it("exposes all commands", () => {
		const expected = [
			"ai",
			"ask",
			"check",
			"ci",
			"code",
			"commit",
			"context",
			"cron",
			"doctor",
			"embed",
			"eval",
			"fix",
			"goal",
			"guardrail",
			"ignore",
			"index",
			"init",
			"mcp",
			"message",
			"pr",
			"prompt",
			"push",
			"read",
			"review",
			"run",
			"scaffold",
			"search",
			"skills",
			"worktree",
		];
		for (const cmd of expected) {
			expect((sdk as Record<string, unknown>)[cmd]).toBeDefined();
		}
	});
});
