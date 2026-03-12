import { describe, expect, test } from "bun:test";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { baseEnv, bunPath } from "../../test-utils/cli-env";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));
const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "fixtures/simple-app.js");
const continueFixturePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures/continue-app.js",
);
const breakpointFixturePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures/breakpoint-app.js",
);
const failureFixturePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures/failure-app.js",
);
const failingBunFixturePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures/failing-bun.fixture.ts",
);

async function waitForFile(path: string, timeoutMs = 1000): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			await access(path);
			return true;
		} catch {}
		await Bun.sleep(25);
	}

	return false;
}

describe("nooa debug node integration", () => {
	test("launch status and stop manage a real node debug session", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-debug-node-"));
		try {
			const env = { ...baseEnv, PWD: root, NOOA_CWD: root };

			const launch = await execa(
				bunPath,
				[binPath, "debug", "launch", "--brk", "node", fixturePath],
				{
					cwd: root,
					reject: false,
					env,
				},
			);

			expect(launch.exitCode).toBe(0);
			expect(launch.stdout).toContain("Session");
			expect(launch.stdout).toContain("started");

			const status = await execa(bunPath, [binPath, "debug", "status", "--json"], {
				cwd: root,
				reject: false,
				env,
			});

			expect(status.exitCode).toBe(0);
			const parsed = JSON.parse(status.stdout) as {
				state: string;
				runtime: string;
				target?: { pid?: number };
			};
			expect(parsed.state).toBe("paused");
			expect(parsed.runtime).toBe("node");
			expect(parsed.target?.pid).toBeDefined();

			const stop = await execa(bunPath, [binPath, "debug", "stop"], {
				cwd: root,
				reject: false,
				env,
			});

			expect(stop.exitCode).toBe(0);
			expect(stop.stdout).toContain("stopped");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("state returns paused snapshot for a real node debug session", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-debug-node-"));
		try {
			const env = { ...baseEnv, PWD: root, NOOA_CWD: root };

			const launch = await execa(
				bunPath,
				[binPath, "debug", "launch", "--brk", "node", fixturePath],
				{
					cwd: root,
					reject: false,
					env,
				},
			);

			expect(launch.exitCode).toBe(0);

			const state = await execa(bunPath, [binPath, "debug", "state", "--json"], {
				cwd: root,
				reject: false,
				env,
			});

			expect(state.exitCode).toBe(0);
			const parsed = JSON.parse(state.stdout) as {
				state: string;
				source?: string[];
				stack?: Array<{ ref?: string }>;
			};
			expect(parsed.state).toBe("paused");
			expect(parsed.source?.length).toBeGreaterThan(0);
			expect(parsed.stack?.[0]?.ref).toBe("@f0");

			await execa(bunPath, [binPath, "debug", "stop"], {
				cwd: root,
				reject: false,
				env,
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("continue transitions the stored session away from paused", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-debug-node-"));
		try {
			const env = { ...baseEnv, PWD: root, NOOA_CWD: root };

			await execa(
				bunPath,
				[binPath, "debug", "launch", "--brk", "node", fixturePath],
				{
					cwd: root,
					reject: false,
					env,
				},
			);

			const cont = await execa(bunPath, [binPath, "debug", "continue", "--json"], {
				cwd: root,
				reject: false,
				env,
			});

			expect(cont.exitCode).toBe(0);
			const parsed = JSON.parse(cont.stdout) as { state?: string };
			expect(parsed.state).toBe("running");

			await execa(bunPath, [binPath, "debug", "stop"], {
				cwd: root,
				reject: false,
				env,
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("continue resumes a real node target", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-debug-node-"));
		const outputPath = join(root, "continued.txt");
		try {
			const env = {
				...baseEnv,
				PWD: root,
				NOOA_CWD: root,
				DEBUG_OUT: outputPath,
			};

			await execa(
				bunPath,
				[binPath, "debug", "launch", "--brk", "node", continueFixturePath],
				{
					cwd: root,
					reject: false,
					env,
				},
			);

			const cont = await execa(bunPath, [binPath, "debug", "continue", "--json"], {
				cwd: root,
				reject: false,
				env,
			});

			expect(cont.exitCode).toBe(0);
			expect(await waitForFile(outputPath, 1500)).toBe(true);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("inspect-at captures a real paused snapshot before the target line runs", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-debug-node-"));
		const outputPath = join(root, "breakpoint.txt");
		try {
			const env = {
				...baseEnv,
				PWD: root,
				NOOA_CWD: root,
				DEBUG_OUT: outputPath,
			};

			const inspect = await execa(
				bunPath,
				[
					binPath,
					"debug",
					"inspect-at",
					`${breakpointFixturePath}:4`,
					"--json",
					"--",
					"node",
					breakpointFixturePath,
				],
				{
					cwd: root,
					reject: false,
					env,
				},
			);
			expect(inspect.exitCode).toBe(0);
			const parsed = JSON.parse(inspect.stdout) as {
				mode?: string;
				state?: string;
				stack?: Array<{ file?: string; line?: number }>;
				breakpoints?: Array<{ ref?: string }>;
				source?: string[];
				target?: unknown;
			};
			expect(parsed.mode).toBe("inspect-at");
			expect(parsed.state).toBe("paused");
			expect(parsed.stack?.[0]?.file).toContain("breakpoint-app.js");
			expect(parsed.stack?.[0]?.line).toBe(4);
			expect(parsed.breakpoints?.[0]?.ref).toBe("BP#1");
			expect(parsed.source?.join("\n")).toContain("writeFileSync");
			expect(parsed.target).toBeUndefined();
			expect(await waitForFile(outputPath, 300)).toBe(false);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("capture returns a real startup snapshot and stops", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-debug-node-"));
		try {
			const env = {
				...baseEnv,
				PWD: root,
				NOOA_CWD: root,
			};

			const capture = await execa(
				bunPath,
				[
					binPath,
					"debug",
					"capture",
					"--json",
					"--",
					"node",
					fixturePath,
				],
				{
					cwd: root,
					reject: false,
					env,
				},
			);
			expect(capture.exitCode).toBe(0);
			const parsed = JSON.parse(capture.stdout) as {
				mode?: string;
				state?: string;
				source?: string[];
				stack?: Array<{ file?: string; line?: number }>;
				target?: unknown;
			};
			expect(parsed.mode).toBe("capture");
			expect(parsed.state).toBe("paused");
			expect(parsed.source?.length).toBeGreaterThan(0);
			expect(parsed.stack?.[0]?.file).toContain("simple-app.js");
			expect((parsed.stack?.[0]?.line ?? 0) > 0).toBe(true);
			expect(parsed.target).toBeUndefined();
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("inspect-on-failure captures a real paused snapshot on exception", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-debug-node-"));
		try {
			const env = {
				...baseEnv,
				PWD: root,
				NOOA_CWD: root,
			};

			const inspect = await execa(
				bunPath,
				[
					binPath,
					"debug",
					"inspect-on-failure",
					"--json",
					"--",
					"node",
					failureFixturePath,
				],
				{
					cwd: root,
					reject: false,
					env,
				},
			);
			expect(inspect.exitCode).toBe(0);
			const parsed = JSON.parse(inspect.stdout) as {
				mode?: string;
				state?: string;
				stack?: Array<{ file?: string; line?: number }>;
				source?: string[];
				target?: unknown;
				exception?: { reason?: string; message?: string };
			};
			expect(parsed.mode).toBe("inspect-on-failure");
			expect(parsed.state).toBe("paused");
			expect(parsed.stack?.[0]?.file).toContain("failure-app.js");
			expect((parsed.stack?.[0]?.line ?? 0) > 0).toBe(true);
			expect(parsed.source?.join("\n")).toContain('throw new Error("boom")');
			expect(parsed.target).toBeUndefined();
			expect(parsed.exception?.reason).toBe("exception");
			expect(parsed.exception?.message).toContain("boom");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("inspect-test-failure captures evidence from a real failing bun test", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-debug-node-"));
		try {
			const env = {
				...baseEnv,
				PWD: root,
				NOOA_CWD: root,
			};

			const inspect = await execa(
				bunPath,
				[
					binPath,
					"debug",
					"inspect-test-failure",
					"--json",
					"--",
					"bun",
					"test",
					failingBunFixturePath,
				],
				{
					cwd: root,
					reject: false,
					env,
				},
			);
			expect(inspect.exitCode).toBe(0);
			const parsed = JSON.parse(inspect.stdout) as {
				mode?: string;
				state?: string;
				stack?: Array<{ file?: string; line?: number }>;
				source?: string[];
				exception?: { reason?: string; message?: string };
			};
			expect(parsed.mode).toBe("inspect-test-failure");
			expect(parsed.state).toBe("failed");
			expect(parsed.stack?.[0]?.file).toContain("failing-bun.fixture.ts");
			expect(parsed.stack?.[0]?.line).toBe(4);
			expect(parsed.source?.join("\n")).toContain("expect(1).toBe(2)");
			expect(parsed.exception?.reason).toBe("test_failure");
			expect(parsed.exception?.message).toContain("expect(received).toBe");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("vars returns values for a real paused node session", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-debug-node-"));
		try {
			const env = { ...baseEnv, PWD: root, NOOA_CWD: root };

			await execa(
				bunPath,
				[binPath, "debug", "launch", "--brk", "node", fixturePath],
				{
					cwd: root,
					reject: false,
					env,
				},
			);

			const vars = await execa(bunPath, [binPath, "debug", "vars", "--json"], {
				cwd: root,
				reject: false,
				env,
			});

			expect(vars.exitCode).toBe(0);
			const parsed = JSON.parse(vars.stdout) as {
				mode?: string;
				vars?: Array<{ name?: string }>;
			};
			expect(parsed.mode).toBe("vars");
			expect(parsed.vars?.length).toBeGreaterThan(0);
			expect(parsed.vars?.[0]?.name).toBeDefined();

			await execa(bunPath, [binPath, "debug", "stop"], {
				cwd: root,
				reject: false,
				env,
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("eval can inspect a real paused node session", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-debug-node-"));
		try {
			const env = { ...baseEnv, PWD: root, NOOA_CWD: root };

			await execa(
				bunPath,
				[binPath, "debug", "launch", "--brk", "node", fixturePath],
				{
					cwd: root,
					reject: false,
					env,
				},
			);

			const evalResult = await execa(
				bunPath,
				[binPath, "debug", "eval", "1 + 1", "--json"],
				{
					cwd: root,
					reject: false,
					env,
				},
			);

			expect(evalResult.exitCode).toBe(0);
			const parsed = JSON.parse(evalResult.stdout) as {
				mode?: string;
				result?: { value?: string };
			};
			expect(parsed.mode).toBe("eval");
			expect(parsed.result?.value).toContain("2");

			await execa(bunPath, [binPath, "debug", "stop"], {
				cwd: root,
				reject: false,
				env,
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
