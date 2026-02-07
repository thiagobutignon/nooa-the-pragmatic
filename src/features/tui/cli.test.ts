import { afterEach, describe, expect, mock, test } from "bun:test";
import { run } from "./cli";

describe("tui cli", () => {
	afterEach(() => {
		mock.restore();
	});

	test("renders TailApp when tail flag is set", async () => {
		const render = mock(() => {});
		const TailApp = () => null;

		mock.module("ink", () => ({ render }));
		mock.module("../../tui/tail", () => ({ TailApp }));

		const result = await run({ tail: true });

		expect(result.ok).toBe(true);
		expect(render).toHaveBeenCalledTimes(1);
		const element = render.mock.calls[0][0];
		expect(element.type).toBe(TailApp);
	});

	test("renders DashboardView when tail flag is false", async () => {
		const render = mock(() => {});
		const DashboardView = () => null;

		mock.module("ink", () => ({ render }));
		mock.module("../../tui/dashboard", () => ({ DashboardView }));

		const result = await run({ dashboard: true, tail: false });

		expect(result.ok).toBe(true);
		expect(render).toHaveBeenCalledTimes(1);
		const element = render.mock.calls[0][0];
		expect(element.type).toBe(DashboardView);
	});
});
