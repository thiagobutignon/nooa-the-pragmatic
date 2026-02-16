import { describe, expect, it } from "bun:test";
import { executeDoctorCheck } from "./execute";

describe("executeDoctorCheck", () => {
	it("should check all required tools and return result", async () => {
		const mockExeca = async (cmd: string) => {
			if (cmd === "which") {
				return { exitCode: 0 };
			}
			if (cmd === "bun") return { stdout: "1.0.0" };
			if (cmd === "git") return { stdout: "2.39.0" };
			if (cmd === "rg") return { stdout: "13.0.0" };
			if (cmd === "sqlite3") return { stdout: "3.40.0" };
			return { stdout: "unknown" };
		};

		const result = await executeDoctorCheck(undefined, mockExeca as any);

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
