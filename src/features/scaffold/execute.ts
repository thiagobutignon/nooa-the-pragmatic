import { join } from "node:path";
import type { EventBus } from "../../core/event-bus";
import { createTraceId } from "../../core/logger";
import { telemetry } from "../../core/telemetry";
import type { RenderContext } from "./engine";
import { ScaffoldEngine } from "./engine";

export interface ScaffoldOptions {
	type: "command" | "prompt";
	name: string;
	force?: boolean;
	dryRun?: boolean;
	withDocs?: boolean;
}

export async function executeScaffold(
	options: ScaffoldOptions,
	bus?: EventBus,
	engineOverride?: ScaffoldEngine,
) {
	const traceId = createTraceId();
	const startTime = Date.now();
	const results: string[] = [];
	const root = process.cwd();

	const engine = engineOverride ?? new ScaffoldEngine(
		join(root, "src/features/scaffold/templates"),
	);

	// 1. Validation
	engine.validateName(options.name);

	const camelName = options.name
		.split("-")
		.map((part, i) =>
			i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
		)
		.join("");

	const context: RenderContext & { camelName: string } = {
		name: options.name,
		camelName,
		Command: options.name
			.split("-")
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(""),
		repo_root: root,
		year: new Date().getFullYear().toString(),
	};

	// 3. Generation
	if (options.type === "command") {
		const featureDir = join(root, "src/features", options.name);

		const files = [
			{ tpl: "command-cli.ts", path: join(featureDir, "cli.ts") },
			{ tpl: "command-cli-test.ts", path: join(featureDir, "cli.test.ts") },
		];

		if (options.withDocs) {
			files.push({
				tpl: "command-docs.md",
				path: join(root, "docs/features", `${options.name}.md`),
			});
		}

		for (const file of files) {
			const content = await engine.renderTemplate(file.tpl, context);
			await engine.write(file.path, content, {
				force: options.force,
				dryRun: options.dryRun,
			});
			results.push(file.path);
		}
	} else if (options.type === "prompt") {
		const promptPath = join(
			root,
			"src/features/prompt/templates",
			`${options.name}.md`,
		);
		const content = await engine.renderTemplate("prompt-template.md", context);
		await engine.write(promptPath, content, {
			force: options.force,
			dryRun: options.dryRun,
			withDocs: Boolean(options.withDocs),
		});
		results.push(promptPath);
	}

	// 4. Telemetry
	telemetry.track(
		{
			event: `scaffold.${options.type}.success`,
			level: "info",
			success: true,
			duration_ms: Date.now() - startTime,
			trace_id: traceId,
			metadata: {
				name: options.name,
				kind: options.type,
				files_written: options.dryRun ? 0 : results.length,
				dry_run: !!options.dryRun,
				with_docs: !!options.withDocs,
			},
		},
		bus,
	);

	return { results, traceId };
}
