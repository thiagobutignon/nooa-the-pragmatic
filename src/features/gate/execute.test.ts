import { describe, expect, spyOn, test } from "bun:test";
import * as gates from "../../core/workflow/gates";
import { checkGate } from "./execute";

// Mock the gate classes
const _MockGate = class {
	id = "mock-gate";
	async check(_ctx: any) {
		return { ok: true };
	}
};

describe("Gate Execute", () => {
	test("returns error for unknown gate", async () => {
		const result = await checkGate({ id: "unknown" });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("gate.unknown_gate");
		}
	});

	test("executes spec gate", async () => {
		const checkSpy = spyOn(gates.SpecGate.prototype, "check").mockResolvedValue(
			{
				ok: true,
			},
		);

		const result = await checkGate({ id: "spec" });

		expect(result.ok).toBe(true);
		if (result.ok && result.data.ok) {
			expect(result.data.gateId).toBe("spec");
		}
		expect(checkSpy).toHaveBeenCalled();
		checkSpy.mockRestore();
	});

	test("executes test gate", async () => {
		const checkSpy = spyOn(gates.TestGate.prototype, "check").mockResolvedValue(
			{
				ok: true,
			},
		);

		const result = await checkGate({ id: "test" });

		expect(result.ok).toBe(true);
		expect(checkSpy).toHaveBeenCalled();
		checkSpy.mockRestore();
	});

	test("executes dogfood gate", async () => {
		const checkSpy = spyOn(
			gates.DogfoodGate.prototype,
			"check",
		).mockResolvedValue({
			ok: true,
		});

		const result = await checkGate({ id: "dogfood" });

		expect(result.ok).toBe(true);
		expect(checkSpy).toHaveBeenCalled();
		checkSpy.mockRestore();
	});

	test("handles checking failure", async () => {
		const checkSpy = spyOn(gates.SpecGate.prototype, "check").mockResolvedValue(
			{
				ok: false,
				reason: "Failed",
				suggestions: ["Try again"],
			},
		);

		const result = await checkGate({ id: "spec" });

		expect(result.ok).toBe(true); // SdkResult is ok, but data indicates failure
		if (result.ok) {
			expect(result.data.ok).toBe(false);
			if (!result.data.ok) {
				expect(result.data.reason).toBe("Failed");
				expect(result.data.suggestions).toEqual(["Try again"]);
			}
		}
		checkSpy.mockRestore();
	});

	test("passes context correctly", async () => {
		let capturedCtx: any;
		const checkSpy = spyOn(
			gates.SpecGate.prototype,
			"check",
		).mockImplementation(async (ctx) => {
			capturedCtx = ctx;
			return { ok: true };
		});

		await checkGate({ id: "spec", target: "foo", traceId: "tid" });

		expect(capturedCtx.traceId).toBe("tid");
		expect(capturedCtx.args.target).toBe("foo");
		expect(capturedCtx.command).toBe("gate");

		checkSpy.mockRestore();
	});
});
