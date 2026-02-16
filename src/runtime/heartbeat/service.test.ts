import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HeartbeatService } from "./service";

describe("HeartbeatService", () => {
	let workspace: string;

	beforeEach(async () => {
		workspace = await mkdtemp(join(tmpdir(), "nooa-hb-"));
		await mkdir(join(workspace, ".nooa"), { recursive: true });
	});

	afterEach(async () => {
		await rm(workspace, { recursive: true, force: true });
	});

	it("reads HEARTBEAT.md content", async () => {
		await writeFile(
			join(workspace, ".nooa", "HEARTBEAT.md"),
			"# Periodic Tasks\n- Check disk usage every 30 minutes\n- Summarize daily notes at end of day",
		);

		const service = new HeartbeatService(workspace);
		const content = await service.readHeartbeat();
		expect(content).toContain("Check disk usage");
	});

	it("returns empty string if no HEARTBEAT.md", async () => {
		const service = new HeartbeatService(workspace);
		const content = await service.readHeartbeat();
		expect(content).toBe("");
	});

	it("creates default template if requested", async () => {
		const service = new HeartbeatService(workspace);
		await service.ensureTemplate();
		const content = await service.readHeartbeat();
		expect(content).toContain("Periodic Tasks");
	});

	it("builds heartbeat prompt with timestamp", async () => {
		await writeFile(
			join(workspace, ".nooa", "HEARTBEAT.md"),
			"- Check for new issues",
		);

		const service = new HeartbeatService(workspace);
		const prompt = await service.buildPrompt();
		expect(prompt).toContain("Check for new issues");
		expect(prompt).toContain("Current time:");
	});
});
