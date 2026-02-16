import { describe, expect, spyOn, test } from "bun:test";
import * as fsSync from "node:fs";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import {
	addPattern,
	checkPathIgnored,
	loadIgnore,
	matchesPattern,
	removePattern,
	saveIgnore,
} from "./execute";

describe("Ignore Execute", () => {
	const cwd = "/test/cwd";
	const ignorePath = join(cwd, ".nooa-ignore");

	test("loadIgnore returns empty array if file does not exist", async () => {
		spyOn(fsSync, "existsSync").mockReturnValue(false);
		const patterns = await loadIgnore(cwd);
		expect(patterns).toEqual([]);
		spyOn(fsSync, "existsSync").mockRestore();
	});

	test("loadIgnore reads and parses patterns", async () => {
		spyOn(fsSync, "existsSync").mockReturnValue(true);
		spyOn(fs, "readFile").mockResolvedValue("*.log\n# comment\ndist/\n");

		const patterns = await loadIgnore(cwd);
		expect(patterns).toEqual(["*.log", "dist/"]);

		spyOn(fsSync, "existsSync").mockRestore();
		spyOn(fs, "readFile").mockRestore();
	});

	test("saveIgnore writes patterns with header", async () => {
		const writeFileSpy = spyOn(fs, "writeFile").mockResolvedValue(undefined);
		await saveIgnore(["foo", "bar"], cwd);

		expect(writeFileSpy).toHaveBeenCalledWith(
			ignorePath,
			expect.stringContaining("# NOOA Policy Ignore"),
		);
		expect(writeFileSpy).toHaveBeenCalledWith(
			ignorePath,
			expect.stringContaining("foo\nbar\n"),
		);

		writeFileSpy.mockRestore();
	});

	test("addPattern adds new pattern", async () => {
		spyOn(fsSync, "existsSync").mockReturnValue(true);
		spyOn(fs, "readFile").mockResolvedValue("foo\n");
		const writeFileSpy = spyOn(fs, "writeFile").mockResolvedValue(undefined);

		const result = await addPattern("bar", cwd);

		expect(result).toBe(true);
		expect(writeFileSpy).toHaveBeenCalledWith(
			ignorePath,
			expect.stringContaining("foo\nbar"),
		);

		spyOn(fsSync, "existsSync").mockRestore();
		spyOn(fs, "readFile").mockRestore();
		writeFileSpy.mockRestore();
	});

	test("addPattern ignores duplicate pattern", async () => {
		spyOn(fsSync, "existsSync").mockReturnValue(true);
		spyOn(fs, "readFile").mockResolvedValue("foo\n");
		const writeFileSpy = spyOn(fs, "writeFile").mockResolvedValue(undefined);

		const result = await addPattern("foo", cwd);

		expect(result).toBe(false);
		expect(writeFileSpy).not.toHaveBeenCalled();

		spyOn(fsSync, "existsSync").mockRestore();
		spyOn(fs, "readFile").mockRestore();
		writeFileSpy.mockRestore();
	});

	test("removePattern removes existing pattern", async () => {
		spyOn(fsSync, "existsSync").mockReturnValue(true);
		spyOn(fs, "readFile").mockResolvedValue("foo\nbar\n");
		const writeFileSpy = spyOn(fs, "writeFile").mockResolvedValue(undefined);

		const result = await removePattern("foo", cwd);

		expect(result).toBe(true);
		expect(writeFileSpy).toHaveBeenCalledWith(
			ignorePath,
			expect.not.stringContaining("foo"),
		);

		spyOn(fsSync, "existsSync").mockRestore();
		spyOn(fs, "readFile").mockRestore();
		writeFileSpy.mockRestore();
	});

	test("removePattern ignores missing pattern", async () => {
		spyOn(fsSync, "existsSync").mockReturnValue(true);
		spyOn(fs, "readFile").mockResolvedValue("foo\n");
		const writeFileSpy = spyOn(fs, "writeFile").mockResolvedValue(undefined);

		const result = await removePattern("bar", cwd);

		expect(result).toBe(false);
		expect(writeFileSpy).not.toHaveBeenCalled();

		spyOn(fsSync, "existsSync").mockRestore();
		spyOn(fs, "readFile").mockRestore();
		writeFileSpy.mockRestore();
	});

	test("checkPathIgnored returns false if no ignore file", async () => {
		spyOn(fsSync, "existsSync").mockReturnValue(false);
		const result = await checkPathIgnored("foo.log", cwd);
		expect(result.ignored).toBe(false);
		spyOn(fsSync, "existsSync").mockRestore();
	});

	test("checkPathIgnored matches pattern", async () => {
		spyOn(fsSync, "existsSync").mockReturnValue(true);
		spyOn(fs, "readFile").mockResolvedValue("*.log\n");

		const result = await checkPathIgnored("app.log", cwd);
		expect(result.ignored).toBe(true);
		if (result.ignored) {
			expect(result.pattern).toBe("*.log");
		}

		spyOn(fsSync, "existsSync").mockRestore();
		spyOn(fs, "readFile").mockRestore();
	});

	test("checkPathIgnored returns false for non-match", async () => {
		spyOn(fsSync, "existsSync").mockReturnValue(true);
		spyOn(fs, "readFile").mockResolvedValue("*.log\n");

		const result = await checkPathIgnored("readme.md", cwd);
		expect(result.ignored).toBe(false);

		spyOn(fsSync, "existsSync").mockRestore();
		spyOn(fs, "readFile").mockRestore();
	});

	test("checkPathIgnored handles dot path", async () => {
		spyOn(fsSync, "existsSync").mockReturnValue(true);
		spyOn(fs, "readFile").mockResolvedValue("node_modules/\n");

		const result = await checkPathIgnored(".", cwd);
		expect(result.ignored).toBe(false);

		spyOn(fsSync, "existsSync").mockRestore();
		spyOn(fs, "readFile").mockRestore();
	});

	test("matchesPattern checks single pattern", () => {
		expect(matchesPattern("*.log", "app.log")).toBe(true);
		expect(matchesPattern("*.log", "readme.md")).toBe(false);
		expect(matchesPattern("", "app.log")).toBe(false);
	});
});
