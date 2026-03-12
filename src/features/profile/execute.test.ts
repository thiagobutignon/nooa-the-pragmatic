import { describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type CpuProfile,
	executeProfileInspect,
	run,
	summarizeCpuProfile,
} from "./execute";

describe("profile execute", () => {
	it("summarizes hotspots from a CPU profile for agent consumption", () => {
		const profile: CpuProfile = {
			nodes: [
				{
					id: 1,
					callFrame: {
						functionName: "(root)",
						scriptId: "0",
						url: "",
						lineNumber: -1,
						columnNumber: -1,
					},
					children: [2, 3],
				},
				{
					id: 2,
					callFrame: {
						functionName: "busySpin",
						scriptId: "1",
						url: "/tmp/cpu-busy.js",
						lineNumber: 0,
						columnNumber: 0,
					},
					hitCount: 8,
				},
				{
					id: 3,
					callFrame: {
						functionName: "helper",
						scriptId: "1",
						url: "/tmp/cpu-busy.js",
						lineNumber: 10,
						columnNumber: 0,
					},
					hitCount: 2,
				},
			],
			samples: [2, 2, 2, 3],
			timeDeltas: [4_000, 4_000, 4_000, 2_000],
		};

		const summary = summarizeCpuProfile(profile);
		expect(summary.total_samples).toBe(4);
		expect(summary.total_profiled_ms).toBe(14);
		expect(summary.hotspots[0]?.function).toBe("busySpin");
		expect(summary.hotspots[0]?.self_ms).toBe(12);
		expect(summary.hotspots[0]?.samples).toBe(3);
	});

	it("aggregates duplicate frames so runtime internals do not flood the summary", () => {
		const profile: CpuProfile = {
			nodes: [
				{
					id: 1,
					callFrame: {
						functionName: "compileForInternalLoader",
						scriptId: "10",
						url: "node:internal/bootstrap/realm",
						lineNumber: 382,
						columnNumber: 26,
					},
				},
				{
					id: 2,
					callFrame: {
						functionName: "compileForInternalLoader",
						scriptId: "11",
						url: "node:internal/bootstrap/realm",
						lineNumber: 382,
						columnNumber: 26,
					},
				},
				{
					id: 3,
					callFrame: {
						functionName: "busySpin",
						scriptId: "1",
						url: "/tmp/cpu-busy.js",
						lineNumber: 0,
						columnNumber: 0,
					},
				},
			],
			samples: [1, 2, 3, 3],
			timeDeltas: [1_000, 1_500, 4_000, 4_000],
		};

		const summary = summarizeCpuProfile(profile);
		expect(summary.hotspots).toHaveLength(2);
		expect(summary.hotspots[0]).toMatchObject({
			function: "busySpin",
			url: "/tmp/cpu-busy.js",
			samples: 2,
			self_ms: 8,
		});
		expect(summary.hotspots[1]).toMatchObject({
			function: "compileForInternalLoader",
			url: "node:internal/bootstrap/realm",
			samples: 2,
			self_ms: 2.5,
		});
	});

	it("rejects unsupported runtimes", async () => {
		const result = await run({
			action: "inspect",
			command: ["python", "script.py"],
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("profile.invalid_target");
		}
	});

	it("normalizes runtime failures when profile output is missing", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "nooa-profile-missing-"));

		const result = await run(
			{
				action: "inspect",
				command: ["node", "script.js"],
				cwd,
			},
			async () => ({
				exitCode: 0,
				stdout: "",
				stderr: "WriteFailed: Failed to write CPU profile",
			}),
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("profile.runtime_error");
			expect(result.error.message).toContain("missing CPU profile");
			expect(result.error.message).toContain("WriteFailed");
		}
	});

	it("preserves non-zero exit codes when a profile is captured", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "nooa-profile-exit-"));

		const result = await executeProfileInspect(
			{
				action: "inspect",
				command: ["node", "script.js"],
				cwd,
			},
			async (_file, args) => {
				const dirArg = args.find((arg) => arg.startsWith("--cpu-prof-dir="));
				const nameArg = args.find((arg) => arg.startsWith("--cpu-prof-name="));
				const profileDir = dirArg?.split("=")[1];
				const profileName = nameArg?.split("=")[1];
				expect(profileDir).toBeDefined();
				expect(profileName).toBeDefined();
				await mkdir(profileDir!, { recursive: true });
				await writeFile(
					join(profileDir!, profileName!),
					JSON.stringify({
						nodes: [
							{
								id: 1,
								callFrame: {
									functionName: "busySpin",
									scriptId: "1",
									url: "/tmp/cpu-busy.js",
									lineNumber: 0,
									columnNumber: 0,
								},
								hitCount: 1,
							},
						],
						samples: [1],
						timeDeltas: [5_000],
					} satisfies CpuProfile),
					"utf-8",
				);
				return {
					exitCode: 7,
					stdout: "partial output",
					stderr: "failure details",
				};
			},
		);

		expect(result.runtime).toBe("node");
		expect(result.exit_code).toBe(7);
		expect(result.hotspots[0]?.function).toBe("busySpin");
		expect(result.stdout).toBe("partial output");
		expect(result.stderr).toBe("failure details");
	});

	it("supports bun targets when the runtime produces a profile", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "nooa-profile-bun-"));

		const result = await executeProfileInspect(
			{
				action: "inspect",
				command: ["bun", "script.ts"],
				cwd,
			},
			async (_file, args) => {
				const dirArg = args.find((arg) => arg.startsWith("--cpu-prof-dir="));
				const nameArg = args.find((arg) => arg.startsWith("--cpu-prof-name="));
				const profileDir = dirArg?.split("=")[1];
				const profileName = nameArg?.split("=")[1];
				await mkdir(profileDir!, { recursive: true });
				await writeFile(
					join(profileDir!, profileName!),
					JSON.stringify({
						nodes: [
							{
								id: 1,
								callFrame: {
									functionName: "busySpin",
									scriptId: "1",
									url: "/tmp/cpu-busy.ts",
									lineNumber: 0,
									columnNumber: 0,
								},
								hitCount: 1,
							},
						],
						samples: [1],
						timeDeltas: [4_000],
					} satisfies CpuProfile),
					"utf-8",
				);
				return {
					exitCode: 0,
					stdout: "",
					stderr: "",
				};
			},
		);

		expect(result.runtime).toBe("bun");
		expect(result.hotspots[0]?.url).toContain("cpu-busy.ts");
	});
});
