import type { Command, CommandContext } from "../../core/command";
import { createTraceId, logger } from "../../core/logger";
import { telemetry } from "../../core/telemetry";

const readHelp = `
Usage: nooa read <path> [flags]

Read file contents from the local filesystem.

Arguments:
  <path>      Path to the file to read.

Flags:
  --json      Output JSON with path, bytes, content.
  -h, --help  Show help message.

Examples:
  nooa read README.md
  nooa read src/index.ts --json

Exit Codes:
  0: Success
  1: Runtime Error (failed execution)
  2: Validation Error (invalid path)
`;

const readCommand: Command = {
	name: "read",
	description: "Read file contents",
	options: {}, // No specific flags other than global help/json
	execute: async ({ rawArgs, values: globalValues, bus }: CommandContext) => {
		const { parseArgs } = await import("node:util");
		const { values, positionals } = parseArgs({
			args: rawArgs,
			options: {
				...readCommand.options,
				help: { type: "boolean", short: "h" },
				json: { type: "boolean" }, // shared
			},
			strict: true,
			allowPositionals: true,
		}) as any;

		const traceId = createTraceId();
		const startTime = Date.now();
		logger.setContext({ trace_id: traceId, command: "read" });

		if (values.help) {
			console.log(readHelp);
			logger.clearContext();
			return;
		}

		let path = positionals[1];

		// Handle stdin if no path provided
		if (!path && !process.stdin.isTTY) {
			const stdinText = await new Response(process.stdin).text();
			path = stdinText.trim();
		}

		if (!path) {
			console.error("Error: Path is required.");
			telemetry.track(
				{
					event: "read.failure",
					level: "error",
					success: false,
					duration_ms: Date.now() - startTime,
					trace_id: traceId,
					metadata: { reason: "missing_path" },
				},
				bus,
			);
			logger.warn("read.missing_path", { duration_ms: Date.now() - startTime });
			logger.clearContext();
			process.exitCode = 2;
			return;
		}

		try {
			const { readFile } = await import("node:fs/promises");
			const content = await readFile(path, "utf-8");
			const duration = Date.now() - startTime;

			if (values.json) {
				console.log(
					JSON.stringify(
						{
							path,
							bytes: Buffer.byteLength(content),
							content,
						},
						null,
						2,
					),
				);
			} else {
				process.stdout.write(content);
			}

			telemetry.track(
				{
					event: "read.success",
					level: "info",
					success: true,
					duration_ms: duration,
					trace_id: traceId,
					metadata: { path, bytes: Buffer.byteLength(content) },
				},
				bus,
			);
			logger.info("read.success", {
				path,
				bytes: Buffer.byteLength(content),
				duration_ms: duration,
			});
			bus?.emit("read.completed", {
				path,
				bytes: Buffer.byteLength(content),
				duration_ms: duration,
				trace_id: traceId,
				success: true,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const duration = Date.now() - startTime;
			if (message.toLowerCase().includes("no such file")) {
				console.error(`Error: File not found: ${path}`);
			} else {
				console.error(`Error: ${message}`);
			}

			telemetry.track(
				{
					event: "read.failure",
					level: "error",
					success: false,
					duration_ms: duration,
					trace_id: traceId,
					metadata: { path, error: message },
				},
				bus,
			);
			logger.error("read.failure", error as Error, {
				path,
				duration_ms: duration,
			});
			bus?.emit("read.completed", {
				path,
				duration_ms: duration,
				trace_id: traceId,
				success: false,
				error: message,
			});
			logger.clearContext();
			process.exitCode = 1;
			return;
		}

		logger.clearContext();
	},
};

export default readCommand;
