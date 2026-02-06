import { describe, expect, test } from "bun:test";
import { buildScrollState } from "./scroll";

describe("buildScrollState", () => {
	test("clamps scroll within bounds", () => {
		const state = buildScrollState({ totalLines: 40, viewportLines: 10 });
		state.scrollBy(999);
		expect(state.getOffset()).toBe(30);
		state.scrollBy(-999);
		expect(state.getOffset()).toBe(0);
	});

	test("page scroll respects viewport", () => {
		const state = buildScrollState({ totalLines: 30, viewportLines: 10 });
		state.pageDown();
		expect(state.getOffset()).toBe(10);
		state.pageDown();
		expect(state.getOffset()).toBe(20);
		state.pageDown();
		expect(state.getOffset()).toBe(20);
		state.pageUp();
		expect(state.getOffset()).toBe(10);
	});
});
