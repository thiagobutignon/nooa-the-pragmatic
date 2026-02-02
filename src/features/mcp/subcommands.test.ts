import { expect, test } from "bun:test";
import { disableCommand } from "./disable";
import { enableCommand } from "./enable";
import { installCommand } from "./install";
import { listCommand } from "./list";

test("list command shows help", async () => {
	const exitCode = await listCommand(["--help"]);
	expect(exitCode).toBe(0);
});

test("install command shows help", async () => {
	const exitCode = await installCommand(["--help"]);
	expect(exitCode).toBe(0);
});

test("install command requires package name", async () => {
	const exitCode = await installCommand([]);
	expect(exitCode).toBe(2);
});

test("enable command shows help", async () => {
	const exitCode = await enableCommand(["--help"]);
	expect(exitCode).toBe(0);
});

test("enable command requires MCP name", async () => {
	const exitCode = await enableCommand([]);
	expect(exitCode).toBe(2);
});

test("disable command shows help", async () => {
	const exitCode = await disableCommand(["--help"]);
	expect(exitCode).toBe(0);
});

test("disable command requires MCP name", async () => {
	const exitCode = await disableCommand([]);
	expect(exitCode).toBe(2);
});
