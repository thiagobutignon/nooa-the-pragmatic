import type { Command, CommandContext } from "../../core/command";
import { createTraceId, logger } from "../../core/logger";
import { telemetry } from "../../core/telemetry";

const codeHelp = `
Usage: nooa code <write|patch> <path> [flags]

Code operations to create, overwrite, or patch files.

Arguments:
  <path>              Destination file path.

Flags:
  --from <path>       Read content from a file (otherwise stdin is used).
  --patch             Apply a unified diff from stdin.
  --patch-from <path> Apply a unified diff from a file.
  --overwrite         Overwrite destination if it exists.
  --json              Output result as JSON.
  --dry-run           Do not write the file.
  -h, --help          Show help message.

Examples:
  nooa code write app.ts --from template.ts
  nooa code patch styles.css < fix.patch
  nooa code write config.json --overwrite --json

Exit Codes:
  0: Success
  1: Runtime Error (failed execution)
  2: Validation Error (invalid path or flags)

Notes:
  - --patch/--patch-from cannot be combined with --from.
  - Subcommand 'patch' implies --patch.
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

		const action = positionals[1];
		const traceId = createTraceId();
		const startTime = Date.now();
		logger.setContext({ trace_id: traceId, command: "code", action });

		if (values.help) {
			console.log(codeHelp);
			logger.clearContext();
			return;
		}

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
				logger.clearContext();
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
					} else if (!process.stdin.isTTY) {
						try {
							patchText = await new Response(process.stdin).text();
						} catch {
							patchText = "";
						}
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
						logger.clearContext();
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
					if (!values.from && !process.stdin.isTTY) {
						let stdinText = "";
						try {
							stdinText = await new Response(process.stdin).text();
						} catch {
							stdinText = "";
						}
						if (stdinText.length > 0) {
							content = stdinText;
						}
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
						logger.clearContext();
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
					logger.clearContext();
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
				logger.clearContext();
				process.exitCode = 1;
			}
			logger.clearContext();
			return;
		}

		// Fallback for unknown action
		console.log(codeHelp);
		logger.clearContext();
	},
};

export default codeCommand;
