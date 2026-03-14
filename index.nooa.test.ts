import { describe, expect, mock, test } from "bun:test";
import { EventBus } from "./src/core/event-bus";
import { readFile } from "node:fs/promises";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "./src/test-utils/cli-env";

const run = (args: string[]) =>
	execa(bunPath, ["index.ts", ...args], {
		reject: false,
		env: baseEnv,
		cwd: repoRoot,
	});

describe("nooa root", () => {
	test("nooa --help shows root usage and subcommands", async () => {
		const res = await run(["--help"]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa");
		expect(res.stdout).toContain("debug");
		expect(res.stdout).toContain("search");
		expect(res.stdout).toContain("Search files and file contents");
	});

	test("nooa --version prints 0.0.1", async () => {
		const res = await run(["--version"]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa");
	});

	test("package.json exposes nooa bin", async () => {
		const pkg = JSON.parse(await readFile("package.json", "utf-8"));
		expect(pkg.bin.nooa).toBe("index.ts");
	});
});

describe("nooa main fast path", () => {
	test("known commands execute without loading full registry or MCP aliases", async () => {
		const execute = mock(async () => {});
		const loadCommands = mock(async () => {
			throw new Error("loadCommands should not run for direct command execution");
		});
		const loadCommandByName = mock(async (_featuresDir: string, name: string) => {
			if (name === "read") {
				return {
					name: "read",
					description: "Read file contents",
					execute,
				};
			}
			return undefined;
		});
		const runWithContext = mock(
			async (_context: unknown, fn: () => Promise<void>) => fn(),
		);

		const { main } = await import("./index.ts");
		await main(["read", "README.md", "--json"], {
			createBus: () => new EventBus(),
			loadCommands,
			loadCommandByName,
			runWithContext,
			createTraceId: () => "trace-test",
			autoReflect: async () => {},
			openAliasDb: () => {
				throw new Error("Alias DB should not open for direct command execution");
			},
			createAliasRegistry: () => {
				throw new Error(
					"MCP alias registry should not initialize for direct command execution",
				);
			},
		});

		expect(loadCommandByName).toHaveBeenCalledTimes(1);
		expect(loadCommands).not.toHaveBeenCalled();
		expect(execute).toHaveBeenCalledTimes(1);
	});
});
