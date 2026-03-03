import { describe, expect, it } from "bun:test";
import { executeDoctorCheck } from "./execute";

describe("executeDoctorCheck", () => {
	it("should check all required tools and return result", async () => {
		const mockExeca = async (cmd: string) => {
			if (cmd === "which") {
				return { exitCode: 0, stdout: "" };
			}
			if (cmd === "bun") return { exitCode: 0, stdout: "1.0.0" };
			if (cmd === "git") return { exitCode: 0, stdout: "2.39.0" };
			if (cmd === "rg") return { exitCode: 0, stdout: "13.0.0" };
			if (cmd === "sqlite3") return { exitCode: 0, stdout: "3.40.0" };
			return { exitCode: 0, stdout: "unknown" };
		};

		const result = await executeDoctorCheck(undefined, mockExeca);

		expect(result.traceId).toBeDefined();
		expect(result).toHaveProperty("ok");
		expect(result).toHaveProperty("bun");
		expect(result).toHaveProperty("git");
		expect(result).toHaveProperty("rg");
		expect(result).toHaveProperty("sqlite");
		expect(result).toHaveProperty("duration_ms");

		expect(result.bun.available).toBe(true);
		expect(result.git.available).toBe(true);
		expect(result.rg.available).toBe(true);
		expect(result.sqlite.available).toBe(true);
	});
});
