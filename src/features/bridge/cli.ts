import type { EventBus } from "../../core/event-bus";
import type { OpenApiSpec } from "./bridge.js";

const bridgeHelp = `
Usage: nooa bridge <spec-url-or-path> [flags]

Arguments:
  <spec-url-or-path>   OpenAPI spec URL or local path.

Flags:
  --op <id>          Operation ID to execute.
  --param <k=v>      Parameter in dot notation (can be used multiple times).
  --header <k=v>     Custom header (can be used multiple times).
  --env <path>       Path to .env file for authentication.
  -l, --list         List operations from spec.
  -h, --help         Show help.
`;

type BridgeValues = {
	op?: string;
	param?: string[];
	header?: string[];
	env?: string;
	list?: boolean;
	help?: boolean;
};

export async function runBridgeCommand(
	values: BridgeValues,
	positionals: string[],
	bus?: EventBus,
) {
	if (values.help) {
		console.log(bridgeHelp);
		return;
	}

	const specSource = positionals[0];
	if (!specSource) {
		console.error("Error: OpenAPI spec URL or path is required for bridge.");
		bus?.emit("cli.error", {
			command: "bridge",
			status: "error",
			error: { code: "MISSING_INPUT", message: "Spec URL or path is required" },
		});
		process.exitCode = 1;
		return;
	}

	try {
		const { loadSpec, executeBridgeRequest } = await import("./bridge.js");
		const spec = (await loadSpec(specSource)) as OpenApiSpec;

		if (values.list) {
			console.log(`\nAvailable operations in ${spec.info?.title || "API"}:`);
			for (const [path, methods] of Object.entries(spec.paths || {})) {
				for (const [method, op] of Object.entries(methods)) {
					console.log(
						`  - [${method.toUpperCase()}] ${op.operationId || "no-id"} (${path}): ${op.summary || ""}`,
					);
				}
			}
			return;
		}

		if (!values.op) {
			console.error("Error: --op <operationId> is required.");
			bus?.emit("cli.error", {
				command: "bridge",
				status: "error",
				error: { code: "MISSING_INPUT", message: "--op is required" },
			});
			process.exitCode = 1;
			return;
		}

		const paramsMap: Record<string, string> = {};
		for (const p of values.param || []) {
			const [k, v] = p.split("=");
			if (k && v) paramsMap[k] = v;
		}

		const headersMap: Record<string, string> = {};
		for (const h of values.header || []) {
			const [k, v] = h.split(":");
			if (k && v) headersMap[k.trim()] = v.trim();
		}

		console.error(`🚀 Executing ${values.op}...`);
		const result = await executeBridgeRequest(spec, {
			operationId: values.op,
			params: paramsMap,
			headers: headersMap,
		});

		console.error(`Response [${result.status}] ${result.statusText}`);
		if (typeof result.data === "object") {
			console.log(JSON.stringify(result.data, null, 2));
		} else {
			console.log(result.data);
		}

		if (result.status >= 400) {
			process.exitCode = 1;
		}
		bus?.emit("bridge.executed", {
			command: "bridge",
			status: result.status >= 400 ? "error" : "ok",
			metadata: { operationId: values.op, status: result.status },
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Bridge Error:", message);
		bus?.emit("cli.error", {
			command: "bridge",
			status: "error",
			error: { code: "EXCEPTION", message },
		});
		process.exitCode = 1;
	}
}

export function printBridgeHelp() {
	console.log(bridgeHelp);
}
