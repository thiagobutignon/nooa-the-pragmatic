import { describe, expect, spyOn, test } from "bun:test";
import * as fsPromises from "node:fs/promises";
import * as execaModule from "execa";
import { buildContext } from "./execute";

describe("Context Builder", () => {
	test("extracts context for a given file", async () => {
		const readFileSpy = spyOn(fsPromises, "readFile").mockResolvedValue(
			"import { foo } from './foo';\nexport class Bar {}" as unknown,
		);
		const execaSpy = spyOn(execaModule, "execa").mockResolvedValue({
			stdout: "commit\n",
			exitCode: 0,
		} as unknown);

		const result = await buildContext("src/test.ts");

		expect(result.target).toBe("src/test.ts");
		expect(result.content).toContain("export class Bar");
		expect(result.related).toContain("src/foo.ts");
		expect(result.symbols).toContain("Bar");
		expect(result.recentCommits).toHaveLength(1);

		readFileSpy.mockRestore();
		execaSpy.mockRestore();
	});

	test("falls back to symbol lookup when file not found", async () => {
		const readFileSpy = spyOn(fsPromises, "readFile")
			.mockRejectedValueOnce(new Error("FILE_NOT_FOUND"))
			.mockResolvedValueOnce("content" as unknown);

		const execaSpy = spyOn(execaModule, "execa").mockImplementation(
			(cmd: string, _args: string[]) => {
				if (cmd === "rg")
					return Promise.resolve({
						stdout: "src/found.ts\n",
						exitCode: 0,
					} as unknown);
				if (cmd === "git")
					return Promise.resolve({ stdout: "", exitCode: 0 } as unknown);
				return Promise.reject(new Error("Unknown command"));
			},
		);

		const result = await buildContext("MissingSymbol");

		expect(result.isSymbol).toBe(true);
		expect(result.target).toContain("MissingSymbol (in src/found.ts)");
		expect(readFileSpy).toHaveBeenCalledTimes(2);

		readFileSpy.mockRestore();
		execaSpy.mockRestore();
	});

	test("throws error when symbol lookup fails", async () => {
		const readFileSpy = spyOn(fsPromises, "readFile").mockRejectedValue(
			new Error("NOT_FOUND"),
		);
		const execaSpy = spyOn(execaModule, "execa").mockResolvedValue({
			stdout: "",
			exitCode: 0,
		} as unknown);

		await expect(buildContext("TotallyMissing")).rejects.toThrow(
			"File or symbol 'TotallyMissing' not found.",
		);

		readFileSpy.mockRestore();
		execaSpy.mockRestore();
	});

	test("handles ripgrep error in symbol lookup", async () => {
		const readFileSpy = spyOn(fsPromises, "readFile").mockRejectedValue(
			new Error("NOT_FOUND"),
		);
		const execaSpy = spyOn(execaModule, "execa").mockRejectedValue(
			new Error("rg fail"),
		);

		await expect(buildContext("FailSym")).rejects.toThrow(
			"File or symbol 'FailSym' not found.",
		);

		readFileSpy.mockRestore();
		execaSpy.mockRestore();
	});
});
