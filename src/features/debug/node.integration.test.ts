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
const propsFixturePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures/props-app.js",
);
const consoleFixturePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures/console-app.js",
);
const stepFixturePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures/step-app.js",
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

	test("pause transitions a real running node session into paused", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-debug-node-"));
		try {
			const env = { ...baseEnv, PWD: root, NOOA_CWD: root };

			await execa(
				bunPath,
				[binPath, "debug", "launch", "node", fixturePath],
				{
					cwd: root,
					reject: false,
					env,
				},
			);

			const paused = await execa(bunPath, [binPath, "debug", "pause", "--json"], {
				cwd: root,
				reject: false,
				env,
			});

			expect(paused.exitCode).toBe(0);
			const parsed = JSON.parse(paused.stdout) as {
				mode?: string;
				state?: string;
				source?: string[];
				stack?: Array<{ ref?: string; file?: string; line?: number }>;
			};
			expect(parsed.mode).toBe("pause");
			expect(parsed.state).toBe("paused");
			expect(parsed.stack?.[0]?.ref).toBe("@f0");
			expect(parsed.stack?.[0]?.file).toContain("simple-app.js");
			expect((parsed.stack?.[0]?.line ?? 0) > 0).toBe(true);

			await execa(bunPath, [binPath, "debug", "stop"], {
				cwd: root,
				reject: false,
				env,
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("source returns the current snippet for a real paused node session", async () => {
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

			const source = await execa(bunPath, [binPath, "debug", "source", "--json"], {
				cwd: root,
				reject: false,
				env,
			});

			expect(source.exitCode).toBe(0);
			const parsed = JSON.parse(source.stdout) as {
				mode?: string;
				state?: string;
				source?: string[];
				stack?: Array<{ file?: string }>;
			};
			expect(parsed.mode).toBe("source");
			expect(parsed.state).toBe("paused");
			expect(parsed.source?.length).toBeGreaterThan(0);
			expect(parsed.stack?.[0]?.file).toContain("simple-app.js");

			await execa(bunPath, [binPath, "debug", "stop"], {
				cwd: root,
				reject: false,
				env,
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("source resolves @f0 for a real paused node session", async () => {
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

			await execa(bunPath, [binPath, "debug", "state", "--json"], {
				cwd: root,
				reject: false,
				env,
			});

			const source = await execa(
				bunPath,
				[binPath, "debug", "source", "@f0", "--json"],
				{
					cwd: root,
					reject: false,
					env,
				},
			);

			expect(source.exitCode).toBe(0);
			const parsed = JSON.parse(source.stdout) as {
				mode?: string;
				source?: string[];
			};
			expect(parsed.mode).toBe("source");
			expect(parsed.source?.length).toBeGreaterThan(0);

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

	test("run-to pauses a real node session at the requested location", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-debug-node-"));
		try {
			const env = { ...baseEnv, PWD: root, NOOA_CWD: root };

			await execa(
				bunPath,
				[binPath, "debug", "launch", "--brk", "node", breakpointFixturePath],
				{
					cwd: root,
					reject: false,
					env,
				},
			);

			const runTo = await execa(
				bunPath,
				[binPath, "debug", "run-to", `${breakpointFixturePath}:4`, "--json"],
				{
					cwd: root,
					reject: false,
					env,
				},
			);

			expect(runTo.exitCode).toBe(0);
			const parsed = JSON.parse(runTo.stdout) as {
				mode?: string;
				state?: string;
				stack?: Array<{ file?: string; line?: number }>;
			};
			expect(parsed.mode).toBe("run-to");
			expect(parsed.state).toBe("paused");
			expect(parsed.stack?.[0]?.file).toContain("breakpoint-app.js");
			expect(parsed.stack?.[0]?.line).toBe(4);

			await execa(bunPath, [binPath, "debug", "stop"], {
				cwd: root,
				reject: false,
				env,
			});
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

	test("step into and out navigate a real paused node session", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-debug-node-"));
		try {
			const env = { ...baseEnv, PWD: root, NOOA_CWD: root };

			await execa(
				bunPath,
				[binPath, "debug", "launch", "--brk", "node", stepFixturePath],
				{
					cwd: root,
					reject: false,
					env,
				},
			);

			const runTo = await execa(
				bunPath,
				[binPath, "debug", "run-to", `${stepFixturePath}:7`, "--json"],
				{
					cwd: root,
					reject: false,
					env,
				},
			);
			expect(runTo.exitCode).toBe(0);

			const stepInto = await execa(
				bunPath,
				[binPath, "debug", "step", "into", "--json"],
				{
					cwd: root,
					reject: false,
					env,
				},
			);
			expect(stepInto.exitCode).toBe(0);
			const into = JSON.parse(stepInto.stdout) as {
				state?: string;
				stack?: Array<{ file?: string; line?: number }>;
			};
			expect(into.state).toBe("paused");
			expect(into.stack?.length).toBeGreaterThan(0);
			expect(into.stack?.[0]?.file).toBeDefined();

			const stepOut = await execa(
				bunPath,
				[binPath, "debug", "step", "out", "--json"],
				{
					cwd: root,
					reject: false,
					env,
				},
			);
			expect(stepOut.exitCode).toBe(0);
			const out = JSON.parse(stepOut.stdout) as {
				state?: string;
				stack?: Array<{ file?: string; line?: number }>;
			};
			expect(out.state).toBe("paused");
			expect(out.stack?.length).toBeGreaterThan(0);
			expect(out.stack?.[0]?.file).toBeDefined();

			await execa(bunPath, [binPath, "debug", "stop"], {
				cwd: root,
				reject: false,
				env,
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("props expands a real object ref after pause and eval", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-debug-node-"));
		try {
			const env = { ...baseEnv, PWD: root, NOOA_CWD: root };

			await execa(
				bunPath,
				[binPath, "debug", "launch", "node", propsFixturePath],
				{
					cwd: root,
					reject: false,
					env,
				},
			);

			const paused = await execa(bunPath, [binPath, "debug", "pause", "--json"], {
				cwd: root,
				reject: false,
				env,
			});
			expect(paused.exitCode).toBe(0);

			const evalResult = await execa(
				bunPath,
				[binPath, "debug", "eval", "globalThis.payload", "--json"],
				{
					cwd: root,
					reject: false,
					env,
				},
			);
			expect(evalResult.exitCode).toBe(0);
			const evaluated = JSON.parse(evalResult.stdout) as {
				result?: { ref?: string; value?: string };
			};
			expect(evaluated.result?.ref).toBeDefined();

			const props = await execa(
				bunPath,
				[binPath, "debug", "props", evaluated.result?.ref ?? "@v1", "--json"],
				{
					cwd: root,
					reject: false,
					env,
				},
			);
			expect(props.exitCode).toBe(0);
			const parsed = JSON.parse(props.stdout) as {
				mode?: string;
				vars?: Array<{ name?: string }>;
			};
			expect(parsed.mode).toBe("props");
			expect(parsed.vars?.map((value) => value.name)).toContain("nested");
			expect(parsed.vars?.map((value) => value.name)).toContain("count");

			await execa(bunPath, [binPath, "debug", "stop"], {
				cwd: root,
				reject: false,
				env,
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("console returns structured runtime output for a real node session", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-debug-node-"));
		try {
			const env = { ...baseEnv, PWD: root, NOOA_CWD: root };

			await execa(
				bunPath,
				[binPath, "debug", "launch", "node", consoleFixturePath],
				{
					cwd: root,
					reject: false,
					env,
				},
			);

			const consoleResult = await execa(
				bunPath,
				[binPath, "debug", "console", "--json"],
				{
					cwd: root,
					reject: false,
					env,
				},
			);
			expect(consoleResult.exitCode).toBe(0);
			const parsed = JSON.parse(consoleResult.stdout) as {
				mode?: string;
				console?: Array<{ level?: string; text?: string }>;
			};
			expect(parsed.mode).toBe("console");
			expect(parsed.console?.length).toBeGreaterThan(0);
			expect(parsed.console?.[0]?.level).toBe("log");
			expect(parsed.console?.[0]?.text).toContain("tick");

			await execa(bunPath, [binPath, "debug", "stop"], {
				cwd: root,
				reject: false,
				env,
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("scripts returns loaded script urls for a real node session", async () => {
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

			const scripts = await execa(
				bunPath,
				[binPath, "debug", "scripts", "--json"],
				{
					cwd: root,
					reject: false,
					env,
				},
			);
			expect(scripts.exitCode).toBe(0);
			const parsed = JSON.parse(scripts.stdout) as {
				mode?: string;
				scripts?: Array<{ url?: string }>;
			};
			expect(parsed.mode).toBe("scripts");
			expect(parsed.scripts?.some((script) => script.url?.includes("simple-app.js"))).toBe(
				true,
			);

			await execa(bunPath, [binPath, "debug", "stop"], {
				cwd: root,
				reject: false,
				env,
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("exceptions reports when no exception has been captured in a session", async () => {
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

			const exceptions = await execa(
				bunPath,
				[binPath, "debug", "exceptions", "--json"],
				{
					cwd: root,
					reject: false,
					env,
				},
			);
			expect(exceptions.exitCode).toBe(0);
			const parsed = JSON.parse(exceptions.stdout) as {
				mode?: string;
				raw?: string;
				exception?: { reason?: string };
			};
			expect(parsed.mode).toBe("exceptions");
			expect(parsed.exception).toBeUndefined();
			expect(parsed.raw).toContain("No exception");

			await execa(bunPath, [binPath, "debug", "stop"], {
				cwd: root,
				reject: false,
				env,
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("catch stores exception pause mode for a real node session", async () => {
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

			const catchResult = await execa(
				bunPath,
				[binPath, "debug", "catch", "all", "--json"],
				{
					cwd: root,
					reject: false,
					env,
				},
			);
			expect(catchResult.exitCode).toBe(0);
			const parsed = JSON.parse(catchResult.stdout) as {
				mode?: string;
				raw?: string;
			};
			expect(parsed.mode).toBe("catch");
			expect(parsed.raw).toContain("all");

			const exceptions = await execa(
				bunPath,
				[binPath, "debug", "exceptions", "--json"],
				{
					cwd: root,
					reject: false,
					env,
				},
			);
			expect(exceptions.exitCode).toBe(0);
			const exceptionState = JSON.parse(exceptions.stdout) as {
				raw?: string;
			};
			expect(exceptionState.raw).toContain("catch=all");

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
