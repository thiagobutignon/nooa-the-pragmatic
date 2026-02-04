import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EventBus } from "../../core/event-bus";
import { createTraceId } from "../../core/logger";
import { telemetry } from "../../core/telemetry";

export interface InitOptions {
	name?: string;
	vibe?: string;
	creature?: string;
	userName?: string;
	userRole?: string;
	workingStyle?: string;
	architecture?: string;
	root?: string;
	force?: boolean;
	dryRun?: boolean;
}

export async function executeInit(options: InitOptions, bus?: EventBus) {
	const traceId = createTraceId();
	const startTime = Date.now();
	const results: string[] = [];
	const root = options.root || process.cwd();
	const nooaDir = join(root, ".nooa");

	// Defaults
	const name = options.name || "NOOA";
	const vibe = options.vibe || "resourceful";
	const creature = options.creature || "protocol droid";
	const userName = options.userName || "Developer";
	const userRole = options.userRole || "Lead Developer";
	const workingStyle = options.workingStyle || "TDD";
	const architecture = options.architecture || "Vertical Slice";
	const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	const context = {
		name,
		vibe,
		creature,
		user_name: userName,
		user_role: userRole,
		working_style: workingStyle,
		architecture,
		timezone,
		emoji: vibe === "snarky" ? "😼" : "🤖",
		root: root,
		test_command: "bun test", // Default, could be derived
		lint_command: "bun lint", // Default
		avatar: "",
		tone_description:
			vibe === "snarky"
				? "Subtle sarcasm, high technical rigor."
				: "Direct, efficient, and helpful.",
	};

	if (!options.dryRun) {
		try {
			await access(nooaDir);
			if (!options.force) {
				throw new Error(
					".nooa directory already exists. Use --force to re-initialize.",
				);
			}
		} catch (error) {
			const err = error as { code?: string };
			if (err.code === "ENOENT") {
				await mkdir(nooaDir, { recursive: true });
			} else {
				throw error;
			}
		}
	}

	const templatesDir = join(import.meta.dirname, "templates");

	const files = [
		{ tpl: "CONSTITUTION.md.tpl", path: join(nooaDir, "CONSTITUTION.md") },
		{ tpl: "IDENTITY.md.tpl", path: join(nooaDir, "IDENTITY.md") },
		{ tpl: "SOUL.md.tpl", path: join(nooaDir, "SOUL.md") },
		{ tpl: "USER.md.tpl", path: join(nooaDir, "USER.md") },
		{ tpl: "TOOLS.md.tpl", path: join(nooaDir, "TOOLS.md") },
	];

	for (const file of files) {
		const tplContent = await Bun.file(
			file.tpl.startsWith("/") ? file.tpl : join(templatesDir, file.tpl),
		).text();
		let rendered = tplContent;
		for (const [key, value] of Object.entries(context)) {
			const regex = new RegExp(`{{${key}}}`, "g");
			rendered = rendered.replace(regex, String(value));
		}

		if (!options.dryRun) {
			await writeFile(file.path, rendered);
		}
		results.push(file.path);
	}

	// Generate .gitignore if it doesn't exist
	const gitignorePath = join(nooaDir, ".gitignore");
	if (!options.dryRun) {
		try {
			await access(gitignorePath);
		} catch {
			await writeFile(gitignorePath, "USER.local.md\n");
			results.push(gitignorePath);
		}
	}

	telemetry.track(
		{
			event: "init.success",
			level: "info",
			success: true,
			duration_ms: Date.now() - startTime,
			trace_id: traceId,
			metadata: {
				name,
				vibe,
				files_written: options.dryRun ? 0 : results.length,
				dry_run: !!options.dryRun,
			},
		},
		bus,
	);

	return { results, traceId };
}
