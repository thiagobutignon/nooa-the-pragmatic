import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { EventBus } from "../../core/event-bus";

const TEST_DB = "telemetry-read-test.db";
const TEST_FILE = "telemetry-read.txt";
let originalDbPath: string | undefined;

beforeEach(() => {
	originalDbPath = process.env.NOOA_DB_PATH;
	process.env.NOOA_DB_PATH = TEST_DB;
	if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
	if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
});

afterEach(async () => {
	try {
		const { telemetry } = await import("../../core/telemetry");
		telemetry.close();
	} catch {
		// ignore if telemetry not loaded
	}
	if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
	if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
	if (originalDbPath === undefined) {
		delete process.env.NOOA_DB_PATH;
	} else {
		process.env.NOOA_DB_PATH = originalDbPath;
	}
});

describe("Read Command Definition", () => {
	test("exports valid command", async () => {
		const { default: cmd } = await import("./cli");
		expect(cmd.name).toBe("read");
		expect(cmd.description).toContain("Read file");
		expect(typeof cmd.execute).toBe("function");
	});

	test("records telemetry on successful read", async () => {
		writeFileSync(TEST_FILE, "hello-read");
		const { default: cmd } = await import("./cli");
		const { telemetry } = await import("../../core/telemetry");

		await cmd.execute({
			args: ["read", TEST_FILE],
			values: {},
			bus: new EventBus(),
		});

		const rows = telemetry.list({ event: "read.success" });
		expect(rows.length).toBeGreaterThan(0);
		telemetry.close();
	});
});
