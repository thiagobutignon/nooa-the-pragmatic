import { describe, expect, test } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { run } from "./cli";

const tmpRoot = join(import.meta.dir, "tmp-replay");

describe("replay.run", () => {
	test("fails when action is missing", async () => {
		const result = await run({ action: undefined });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("replay.missing_action");
		}
	});

	test("add creates a node", async () => {
		await rm(tmpRoot, { recursive: true, force: true });
		await mkdir(join(tmpRoot, ".nooa"), { recursive: true });

		const result = await run({
			action: "add",
			label: "A",
			root: tmpRoot,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("add failed");
		}
		const raw = await readFile(join(tmpRoot, ".nooa/replay.json"), "utf-8");
		const data = JSON.parse(raw) as { nodes: { label: string }[] };
		expect(data.nodes.length).toBe(1);
		expect(data.nodes[0].label).toBe("A");
		expect(result.data.node.label).toBe("A");
	});

	test("link creates next edge and prevents cycles", async () => {
		await rm(tmpRoot, { recursive: true, force: true });
		await mkdir(join(tmpRoot, ".nooa"), { recursive: true });

		const a = await run({ action: "add", label: "A", root: tmpRoot });
		const b = await run({ action: "add", label: "B", root: tmpRoot });
		if (!a.ok || !b.ok) {
			throw new Error("setup failed");
		}

		const link = await run({
			action: "link",
			from: a.data.node.id,
			to: b.data.node.id,
			root: tmpRoot,
		});
		expect(link.ok).toBe(true);
		if (!link.ok) {
			throw new Error("link failed");
		}
		expect(link.data.edge.from).toBe(a.data.node.id);

		const cycle = await run({
			action: "link",
			from: b.data.node.id,
			to: a.data.node.id,
			root: tmpRoot,
		});
		expect(cycle.ok).toBe(false);
		if (!cycle.ok) {
			expect(cycle.error.code).toBe("replay.cycle_detected");
		}
	});

	test("fix creates node and impact edges", async () => {
		await rm(tmpRoot, { recursive: true, force: true });
		await mkdir(join(tmpRoot, ".nooa"), { recursive: true });

		const a = await run({ action: "add", label: "A", root: tmpRoot });
		const b = await run({ action: "add", label: "B", root: tmpRoot });
		const c = await run({ action: "add", label: "C", root: tmpRoot });
		if (!a.ok || !b.ok || !c.ok) {
			throw new Error("setup failed");
		}

		const aId = a.data.node.id;
		const bId = b.data.node.id;
		const cId = c.data.node.id;

		await run({ action: "link", from: aId, to: bId, root: tmpRoot });
		await run({ action: "link", from: bId, to: cId, root: tmpRoot });

		const fix = await run({
			action: "fix",
			targetId: bId,
			label: "Fix B",
			root: tmpRoot,
		});
		expect(fix.ok).toBe(true);

		const raw = await readFile(join(tmpRoot, ".nooa/replay.json"), "utf-8");
		const data = JSON.parse(raw) as {
			edges: { kind: string }[];
			nodes: { type: string }[];
		};
		const impactEdges = data.edges.filter((edge) => edge.kind === "impact");
		expect(impactEdges.length).toBeGreaterThanOrEqual(1);
		expect(data.nodes.some((node) => node.type === "fix")).toBe(true);
	});

	test("show returns summary", async () => {
		await rm(tmpRoot, { recursive: true, force: true });
		await mkdir(join(tmpRoot, ".nooa"), { recursive: true });

		const add = await run({ action: "add", label: "A", root: tmpRoot });
		expect(add.ok).toBe(true);

		const result = await run({ action: "show", root: tmpRoot });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.summary.nodes).toBeGreaterThanOrEqual(1);
	});

	test("show returns structured investigation metadata for a node", async () => {
		await rm(tmpRoot, { recursive: true, force: true });
		await mkdir(join(tmpRoot, ".nooa"), { recursive: true });

		const investigationNode = {
			id: "node-investigation",
			label: "US-001 [failed]",
			type: "step",
			createdAt: new Date().toISOString(),
			meta: {
				summary:
					"run=ralph-auth story=US-001 iteration=1 status=failed investigation=test_failure location=/tmp/demo/failing.test.ts:7:3",
				tags: [
					"ralph",
					"story:US-001",
					"status:failed",
					"investigation:test_failure",
				],
				investigation: {
					kind: "test_failure",
					reason: "test_failure",
					message: "expect(received).toBe(expected)",
					location: {
						file: "/tmp/demo/failing.test.ts",
						line: 7,
						column: 3,
					},
					source: ["expect(1).toBe(2);"],
				},
			},
		};

		await Bun.write(
			join(tmpRoot, ".nooa/replay.json"),
			JSON.stringify({
				version: "1.0.0",
				nodes: [investigationNode],
				edges: [],
			}),
		);

		const result = await run({
			action: "show",
			id: investigationNode.id,
			root: tmpRoot,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.node.meta?.investigation?.kind).toBe("test_failure");
		expect(result.data.node.meta?.investigation?.location).toEqual({
			file: "/tmp/demo/failing.test.ts",
			line: 7,
			column: 3,
		});
	});

	test("cli output is human-friendly without --json", async () => {
		const cliRoot = join(tmpRoot, "cli-output");
		await rm(cliRoot, { recursive: true, force: true });
		await mkdir(cliRoot, { recursive: true });

		const repoRoot = process.cwd();
		const { stdout } = await execa(
			"bun",
			["index.ts", "replay", "add", "A", "--root", cliRoot],
			{
				cwd: repoRoot,
			},
		);

		expect(stdout).toContain("Created node");
		expect(stdout.trim().startsWith("{")).toBe(false);
	});

	test("show output renders investigation context for humans", async () => {
		const cliRoot = join(tmpRoot, "cli-show-investigation");
		await rm(cliRoot, { recursive: true, force: true });
		await mkdir(join(cliRoot, ".nooa"), { recursive: true });

		await Bun.write(
			join(cliRoot, ".nooa/replay.json"),
			JSON.stringify({
				version: "1.0.0",
				nodes: [
					{
						id: "node-investigation",
						label: "US-001 [failed]",
						type: "step",
						createdAt: new Date().toISOString(),
						meta: {
							summary:
								"run=ralph-auth story=US-001 iteration=1 status=failed investigation=test_failure location=/tmp/demo/failing.test.ts:7:3",
							tags: [
								"ralph",
								"story:US-001",
								"status:failed",
								"investigation:test_failure",
							],
							investigation: {
								kind: "test_failure",
								reason: "test_failure",
								message: "expect(received).toBe(expected)",
								location: {
									file: "/tmp/demo/failing.test.ts",
									line: 7,
									column: 3,
								},
								source: ["expect(1).toBe(2);"],
							},
						},
					},
				],
				edges: [],
			}),
		);

		const repoRoot = process.cwd();
		const { stdout } = await execa(
			"bun",
			[
				"index.ts",
				"replay",
				"show",
				"node-investigation",
				"--root",
				cliRoot,
			],
			{
				cwd: repoRoot,
			},
		);

		expect(stdout).toContain("Node node-investigation");
		expect(stdout).toContain("Investigation: test_failure");
		expect(stdout).toContain("Location: /tmp/demo/failing.test.ts:7:3");
		expect(stdout).toContain("Message: expect(received).toBe(expected)");
		expect(stdout).toContain("Source:");
	});

	test("show output renders profile investigation context for humans", async () => {
		const cliRoot = join(tmpRoot, "cli-show-profile-investigation");
		await rm(cliRoot, { recursive: true, force: true });
		await mkdir(join(cliRoot, ".nooa"), { recursive: true });

		await Bun.write(
			join(cliRoot, ".nooa/replay.json"),
			JSON.stringify({
				version: "1.0.0",
				nodes: [
					{
						id: "node-profile",
						label: "US-010 [profiled]",
						type: "step",
						createdAt: new Date().toISOString(),
						meta: {
							summary:
								"run=ralph-auth story=US-010 iteration=1 status=reviewing investigation=profile_hotspots",
							tags: [
								"ralph",
								"story:US-010",
								"status:reviewing",
								"investigation:profile_hotspots",
							],
							investigation: {
								kind: "profile_hotspots",
								runtime: "node",
								duration_ms: 67,
								hotspots: [
									{
										function: "busySpin",
										url: "/tmp/cpu-busy.js",
										line: 1,
										column: 1,
										self_ms: 8,
										samples: 2,
									},
									{
										function: "compileForInternalLoader",
										url: "node:internal/bootstrap/realm",
										line: 383,
										column: 27,
										self_ms: 2.5,
										samples: 2,
									},
								],
							},
						},
					},
				],
				edges: [],
			}),
		);

		const repoRoot = process.cwd();
		const { stdout } = await execa(
			"bun",
			["index.ts", "replay", "show", "node-profile", "--root", cliRoot],
			{
				cwd: repoRoot,
			},
		);

		expect(stdout).toContain("Investigation: profile_hotspots");
		expect(stdout).toContain("Runtime: node");
		expect(stdout).toContain("Profile duration: 67ms");
		expect(stdout).toContain("Hotspots:");
		expect(stdout).toContain("- busySpin (8ms, 2 samples) /tmp/cpu-busy.js:1");
	});

	test("show output renders replay relationships for humans", async () => {
		const cliRoot = join(tmpRoot, "cli-show-relations");
		await rm(cliRoot, { recursive: true, force: true });
		await mkdir(join(cliRoot, ".nooa"), { recursive: true });

		await Bun.write(
			join(cliRoot, ".nooa/replay.json"),
			JSON.stringify({
				version: "1.0.0",
				nodes: [
					{
						id: "node-prev",
						label: "US-001 [reviewing]",
						type: "step",
						createdAt: new Date().toISOString(),
					},
					{
						id: "node-failure",
						label: "US-001 [failed]",
						type: "step",
						createdAt: new Date().toISOString(),
						meta: {
							investigation: {
								kind: "test_failure",
								message: "expect(received).toBe(expected)",
							},
						},
					},
					{
						id: "node-retry",
						label: "US-001 [reviewing retry]",
						type: "step",
						createdAt: new Date().toISOString(),
					},
					{
						id: "node-fix",
						label: "Fix failing expectation",
						type: "fix",
						createdAt: new Date().toISOString(),
						fixOf: "node-failure",
					},
					{
						id: "node-impacted",
						label: "US-001 [approved]",
						type: "step",
						createdAt: new Date().toISOString(),
					},
				],
				edges: [
					{ from: "node-prev", to: "node-failure", kind: "next" },
					{ from: "node-failure", to: "node-retry", kind: "next" },
					{ from: "node-failure", to: "node-retry", kind: "retry" },
					{ from: "node-fix", to: "node-failure", kind: "fixes" },
					{ from: "node-fix", to: "node-impacted", kind: "impact" },
				],
			}),
		);

		const repoRoot = process.cwd();
		const { stdout } = await execa(
			"bun",
			["index.ts", "replay", "show", "node-failure", "--root", cliRoot],
			{
				cwd: repoRoot,
			},
		);

		expect(stdout).toContain("Previous:");
		expect(stdout).toContain("node-prev US-001 [reviewing]");
		expect(stdout).toContain("Next:");
		expect(stdout).toContain("node-retry US-001 [reviewing retry]");
		expect(stdout).toContain("Retries:");
		expect(stdout).toContain("node-retry US-001 [reviewing retry]");
		expect(stdout).toContain("Fixes:");
		expect(stdout).toContain("node-fix Fix failing expectation");
		expect(stdout).toContain("Impacts:");
		expect(stdout).toContain("node-impacted US-001 [approved]");
	});
});
