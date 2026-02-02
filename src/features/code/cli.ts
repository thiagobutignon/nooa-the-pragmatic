import type { Command, CommandContext } from "../../core/command";
import { createTraceId, logger } from "../../core/logger";
import { telemetry } from "../../core/telemetry";

const codeHelp = `
Usage: nooa code <subcommand> [args] [flags]

Code operations.

Subcommands:
  write <path>        Create or overwrite a file.
  patch <path>        Apply a unified diff.
  diff [path]         Show git diff for path or all.
  format <path>       Format a file using biome.
  refactor <path> "instruction"  Refactor a file using AI.

Flags:
  --from <path>       Read content from a file (write mode).
  --overwrite         Overwrite destination if it exists (write mode).
  --json              Output result as JSON.
  --dry-run           Do not write the file.
  -h, --help          Show help message.

Examples:
  nooa code write app.ts --from template.ts
  nooa code diff src/
  nooa code format src/index.ts
  nooa code refactor src/utils.ts "rename process to handler"
`;

const codeCommand: Command = {
	name: "code",
	description: "Code operations (write, patch)",
	options: {
		from: { type: "string" },
		overwrite: { type: "boolean" },
		"dry-run": { type: "boolean" },
		patch: { type: "boolean" },
		"patch-from": { type: "string" },
	},
	execute: async ({ rawArgs, values: globalValues, bus }: CommandContext) => {
		const { parseArgs } = await import("node:util");
		const { values, positionals } = parseArgs({
			args: rawArgs,
			options: {
				...codeCommand.options,
				help: { type: "boolean", short: "h" },
				json: { type: "boolean" }, // shared
			},
			strict: true,
			allowPositionals: true,
		}) as any;

		const { getStdinText } = await import("../../core/io");
		const action = positionals[1];
		const traceId = createTraceId();
		const startTime = Date.now();

		if (values.help) {
			console.log(codeHelp);
			return;
		}

		if (action === "diff") {
			const { executeDiff } = await import("./diff");
			const path = positionals[2];
			const diff = await executeDiff(path);
			console.log(diff);
			return;
		}

		if (action === "format") {
			const { executeFormat } = await import("./format");
			const path = positionals[2];
			if (!path) {
				console.error("Error: Path required for format.");
				process.exitCode = 2;
				return;
			}
			const result = await executeFormat(path);
			console.log(result);
			return;
		}

		if (action === "refactor") {
			const { executeRefactor } = await import("./refactor");
			const path = positionals[2];
			const instructions = positionals[3];
			if (!path || !instructions) {
				console.error("Error: Path and instructions required for refactor.");
				process.exitCode = 2;
				return;
			}
			const result = await executeRefactor(path, instructions);
			console.log(result);
			return;
		}
		// The extra `}` was here, closing the `execute` function prematurely.
		// It has been removed.

		if (action === "write" || action === "patch") {
			const targetPath = positionals[2];
			if (!targetPath) {
				console.error("Error: Destination path is required.");
				telemetry.track(
					{
						event: "code.write.failure",
						level: "error",
						success: false,
						duration_ms: Date.now() - startTime,
						trace_id: traceId,
						metadata: { reason: "missing_path" },
					},
					bus,
				);
				logger.warn("code.write.missing_path", {
					duration_ms: Date.now() - startTime,
				});
				process.exitCode = 2;
				return;
			}

			try {
				const { readFile, writeFile } = await import("node:fs/promises");
				const isPatchMode =
					action === "patch" || Boolean(values.patch || values["patch-from"]);
				let content = "";
				let patched = false;

				if (isPatchMode && values.from) {
					console.error("Error: --patch is mutually exclusive with --from.");
					telemetry.track(
						{
							event: "code.patch.failure",
							level: "error",
							success: false,
							duration_ms: Date.now() - startTime,
							trace_id: traceId,
							metadata: { reason: "patch_with_from" },
						},
						bus,
					);
					logger.warn("code.patch.invalid_flags", {
						duration_ms: Date.now() - startTime,
					});
					logger.clearContext();
					process.exitCode = 2;
					return;
				}

				if (isPatchMode) {
					let patchText = "";
					if (values["patch-from"]) {
						patchText = await readFile(String(values["patch-from"]), "utf-8");
					} else {
						patchText = await getStdinText();
					}

					if (!patchText) {
						console.error(
							"Error: Missing patch input. Use --patch-from or stdin.",
						);
						telemetry.track(
							{
								event: "code.patch.failure",
								level: "error",
								success: false,
								duration_ms: Date.now() - startTime,
								trace_id: traceId,
								metadata: { reason: "missing_patch_input" },
							},
							bus,
						);
						logger.warn("code.patch.missing_input", {
							duration_ms: Date.now() - startTime,
						});
						process.exitCode = 2;
						return;
					}

					const { applyPatch } = await import("./patch.js");
					const originalText = await readFile(targetPath, "utf-8");
					content = applyPatch(originalText, patchText);
					patched = true;
					if (!values["dry-run"]) {
						await writeFile(targetPath, content, "utf-8");
					}
				} else {
					if (!values.from) {
						content = await getStdinText();
					}

					if (!content && values.from) {
						content = await readFile(String(values.from), "utf-8");
					}

					if (!content) {
						console.error("Error: Missing input. Use --from or stdin.");
						telemetry.track(
							{
								event: "code.write.failure",
								level: "error",
								success: false,
								duration_ms: Date.now() - startTime,
								trace_id: traceId,
								metadata: { reason: "missing_input" },
							},
							bus,
						);
						logger.warn("code.write.missing_input", {
							duration_ms: Date.now() - startTime,
						});
						process.exitCode = 2;
						return;
					}

					const { writeCodeFile } = await import("./write.js");
					const result = await writeCodeFile({
						path: targetPath,
						content,
						overwrite: Boolean(values.overwrite),
						dryRun: Boolean(values["dry-run"]),
					});

					if (values.json) {
						console.log(
							JSON.stringify(
								{
									path: result.path,
									bytes: result.bytes,
									overwritten: result.overwritten,
									dryRun: Boolean(values["dry-run"]),
									mode: "write",
									patched: false,
								},
								null,
								2,
							),
						);
					}

					const duration = Date.now() - startTime;
					telemetry.track(
						{
							event: "code.write.success",
							level: "info",
							success: true,
							duration_ms: duration,
							trace_id: traceId,
							metadata: {
								path: result.path,
								bytes: result.bytes,
								overwritten: result.overwritten,
								dry_run: Boolean(values["dry-run"]),
							},
						},
						bus,
					);
					logger.info("code.write.success", {
						path: result.path,
						bytes: result.bytes,
						overwritten: result.overwritten,
						dry_run: Boolean(values["dry-run"]),
						duration_ms: duration,
					});
					bus?.emit("code.completed", {
						action: "write",
						path: result.path,
						bytes: result.bytes,
						duration_ms: duration,
						trace_id: traceId,
						success: true,
					});
					return;
				}

				if (values.json) {
					console.log(
						JSON.stringify(
							{
								path: targetPath,
								bytes: Buffer.byteLength(content),
								overwritten: true,
								dryRun: Boolean(values["dry-run"]),
								mode: "patch",
								patched,
							},
							null,
							2,
						),
					);
				}

				const duration = Date.now() - startTime;
				telemetry.track(
					{
						event: "code.patch.success",
						level: "info",
						success: true,
						duration_ms: duration,
						trace_id: traceId,
						metadata: {
							path: targetPath,
							bytes: Buffer.byteLength(content),
							dry_run: Boolean(values["dry-run"]),
						},
					},
					bus,
				);
				logger.info("code.patch.success", {
					path: targetPath,
					bytes: Buffer.byteLength(content),
					dry_run: Boolean(values["dry-run"]),
					duration_ms: duration,
				});
				bus?.emit("code.completed", {
					action: "patch",
					path: targetPath,
					bytes: Buffer.byteLength(content),
					duration_ms: duration,
					trace_id: traceId,
					success: true,
				});
				logger.clearContext();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				const duration = Date.now() - startTime;
				console.error(`Error: ${message}`);
				telemetry.track(
					{
						event: "code.write.failure",
						level: "error",
						success: false,
						duration_ms: duration,
						trace_id: traceId,
						metadata: { error: message },
					},
					bus,
				);
				logger.error("code.write.failure", error as Error, {
					duration_ms: duration,
				});
				bus?.emit("code.completed", {
					action,
					duration_ms: duration,
					trace_id: traceId,
					success: false,
					error: message,
				});
				process.exitCode = 1;
			}
			return;
		}

		// Fallback for unknown action
		console.log(codeHelp);
	},
};

export default codeCommand;
