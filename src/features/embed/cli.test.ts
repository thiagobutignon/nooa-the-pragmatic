import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventBus } from "../../core/event-bus";
import { telemetry } from "../../core/telemetry";
import embedCommand from "./cli";

describe("nooa embed cli direct", () => {
	let testDir: string;
	let bus: EventBus;
	let trackSpy: unknown;

	beforeEach(async () => {
		testDir = join(
			tmpdir(),
			`nooa-embed-cli-direct-${Math.random().toString(36).slice(2, 7)}`,
		);
		await mkdir(testDir, { recursive: true });
		bus = new EventBus();
		// Mock telemetry to avoid DB issues and ensures coverage of the call itself
		trackSpy = spyOn(telemetry, "track").mockReturnValue(1 as unknown);
		process.env.NOOA_EMBED_PROVIDER = "mock";
	});

	afterEach(async () => {
		trackSpy.mockRestore();
		await rm(testDir, { recursive: true, force: true });
	});

	it("shows help via execute", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await embedCommand.execute({
			args: ["embed", "--help"],
			rawArgs: ["embed", "--help"],
			values: { help: true },
			bus,
		});
		expect(logSpy).toHaveBeenCalled();
		logSpy.mockRestore();
	});

	it("embeds text success via execute", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await embedCommand.execute({
			args: ["embed", "text", "hello world"],
			rawArgs: ["embed", "text", "hello world"],
			values: {},
			bus,
		});
		expect(logSpy).toHaveBeenCalled();
		const output = logSpy.mock.calls[0][0];
		const json = JSON.parse(output);
		expect(json.input.value).toBe("hello world");
		logSpy.mockRestore();
	});

	it("embeds file success via execute", async () => {
		const filePath = join(testDir, "input.txt");
		await writeFile(filePath, "file content");
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await embedCommand.execute({
			args: ["embed", "file", filePath],
			rawArgs: ["embed", "file", filePath],
			values: {},
			bus,
		});
		expect(logSpy).toHaveBeenCalled();
		const output = logSpy.mock.calls[0][0];
		const json = JSON.parse(output);
		expect(json.input.type).toBe("file");
		logSpy.mockRestore();
	});

	it("fails on missing action via execute", async () => {
		const errSpy = spyOn(console, "error").mockImplementation(() => {});
		await embedCommand.execute({
			args: ["embed"],
			rawArgs: ["embed"],
			values: {},
			bus,
		});
		expect(errSpy).toHaveBeenCalledWith(
			"Error: Action (text/file) is required.",
		);
		errSpy.mockRestore();
	});

	it("fails on missing text via execute", async () => {
		const errSpy = spyOn(console, "error").mockImplementation(() => {});
		await embedCommand.execute({
			args: ["embed", "text"],
			rawArgs: ["embed", "text"],
			values: {},
			bus,
		});
		expect(errSpy).toHaveBeenCalledWith("Error: Text is required.");
		errSpy.mockRestore();
	});

	it("fails on missing file path via execute", async () => {
		const errSpy = spyOn(console, "error").mockImplementation(() => {});
		await embedCommand.execute({
			args: ["embed", "file"],
			rawArgs: ["embed", "file"],
			values: {},
			bus,
		});
		expect(errSpy).toHaveBeenCalledWith("Error: File path is required.");
		errSpy.mockRestore();
	});

	it("fails on unknown action via execute", async () => {
		const errSpy = spyOn(console, "error").mockImplementation(() => {});
		await embedCommand.execute({
			args: ["embed", "unknown", "val"],
			rawArgs: ["embed", "unknown", "val"],
			values: {},
			bus,
		});
		expect(errSpy).toHaveBeenCalledWith("Error: Unknown embed action.");
		errSpy.mockRestore();
	});

	it("respects --include-embedding flag via execute", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await embedCommand.execute({
			args: ["embed", "text", "test", "--include-embedding"],
			rawArgs: ["embed", "text", "test", "--include-embedding"],
			values: { "include-embedding": true },
			bus,
		});
		const output = logSpy.mock.calls[0][0];
		const json = JSON.parse(output);
		expect(json.embedding).toBeDefined();
		logSpy.mockRestore();
	});

	it("respects --out flag via execute", async () => {
		const outPath = join(testDir, "out.json");
		await embedCommand.execute({
			args: ["embed", "text", "test", "--out", outPath],
			rawArgs: ["embed", "text", "test", "--out", outPath],
			values: { out: outPath },
			bus,
		});
		const saved = JSON.parse(await readFile(outPath, "utf-8"));
		expect(saved.input.value).toBe("test");
	});

	it("handles general errors gracefully in execute", async () => {
		const errSpy = spyOn(console, "error").mockImplementation(() => {});
		// Trigger error by giving a file path that is a directory or similar to cause readFile to fail
		await embedCommand.execute({
			args: ["embed", "file", testDir],
			rawArgs: ["embed", "file", testDir],
			values: {},
			bus,
		});
		expect(errSpy).toHaveBeenCalled();
		expect(errSpy.mock.calls[0][0]).toContain("Error:");
		errSpy.mockRestore();
	});
});
