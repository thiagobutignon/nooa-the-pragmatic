import { describe, expect, it } from "bun:test";
import { DangerousCommandGuard } from "./command-guard";

describe("DangerousCommandGuard", () => {
	const guard = new DangerousCommandGuard();

	describe("blocks destructive commands", () => {
		it.each([
			["rm -rf /", "bulk deletion"],
			["rm -rf ~", "home deletion"],
			["sudo rm -rf /var", "sudo deletion"],
			["format C:", "disk format"],
			["mkfs.ext4 /dev/sda", "filesystem create"],
			["dd if=/dev/zero of=/dev/sda", "disk image"],
			[":(){ :|:& };:", "fork bomb"],
			["shutdown -h now", "system shutdown"],
			["reboot", "system reboot"],
			["poweroff", "system poweroff"],
		])("blocks: %s (%s)", (cmd) => {
			const result = guard.check(cmd);
			expect(result.blocked).toBe(true);
			expect(result.reason).toBeDefined();
		});
	});

	describe("allows safe commands", () => {
		it.each([
			["ls -la", "list files"],
			["cat README.md", "read file"],
			["bun test", "run tests"],
			["git status", "git status"],
			["echo hello", "echo"],
			["bun run check", "lint check"],
			["npm install", "npm install"],
		])("allows: %s (%s)", (cmd) => {
			const result = guard.check(cmd);
			expect(result.blocked).toBe(false);
		});
	});

	it("provides human-readable reason for blocked commands", () => {
		const result = guard.check("rm -rf /");
		expect(result.reason).toContain("rm -rf");
	});
});
