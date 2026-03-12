import { describe, expect, it } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

const fixturePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures/cpu-busy.js",
);

describe("profile CLI", () => {
	it("shows help for inspect", async () => {
		const { stdout, exitCode } = await execa(
			bunPath,
			["index.ts", "profile", "--help"],
			{
				env: baseEnv,
				cwd: repoRoot,
				reject: false,
			},
		);

		expect(exitCode).toBe(0);
		expect(stdout).toContain("Usage: nooa profile");
		expect(stdout).toContain("inspect");
		expect(stdout).toContain("-- <command...>");
	});

	it("runs an atomic CPU profile and returns hotspot summary as JSON", async () => {
		const { stdout, exitCode } = await execa(
			bunPath,
			["index.ts", "profile", "inspect", "--json", "--", "node", fixturePath],
			{
				env: baseEnv,
				cwd: repoRoot,
				reject: false,
			},
		);

		expect(exitCode).toBe(0);
		const payload = JSON.parse(stdout) as {
			command?: string;
			mode?: string;
			runtime?: string;
			exit_code?: number;
			profile_path?: string;
			hotspots?: Array<{ function?: string; url?: string }>;
		};
		expect(payload.command).toBe("profile");
		expect(payload.mode).toBe("inspect");
		expect(payload.runtime).toBe("node");
		expect(payload.exit_code).toBe(0);
		expect(payload.profile_path).toContain(".cpuprofile");
		expect(payload.hotspots?.[0]?.url).toContain("cpu-busy.js");
	});
});
