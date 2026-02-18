import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { EventBus } from "../../core/event-bus";
import { CliChannel } from "../../runtime/channels/cli-channel";
import { Gateway, type GatewayRunner } from "../../runtime/gateway/gateway";
import {
	GATEWAY_INBOUND_EVENT,
	GATEWAY_OUTBOUND_EVENT,
	type GatewayInboundMessage,
	type GatewayOutboundMessage,
} from "../../runtime/gateway/messages";
import { type GatewayConfig, loadGatewayConfig } from "./config";

export interface GatewayRunInput {
	action?: "start" | "status" | "daemon" | "daemon-run";
	daemon?: "start" | "stop" | "status";
	pidPath?: string;
	entrypoint?: string;
	signal?: AbortSignal;
	once?: boolean;
	message?: string;
	config?: GatewayConfig;
	runner?: GatewayRunner;
	defaultRunnerFactory?: () => Promise<GatewayRunner>;
}

export interface GatewayRunResult {
	mode: "start" | "status" | "daemon";
	gatewayMode: "cli";
	running: boolean;
	channels: string[];
	lastResponse?: string;
	pid?: number | null;
}

type GatewaySdkResult =
	| { ok: true; data: GatewayRunResult }
	| { ok: false; error: { code: string; message: string } };

async function readPid(pidPath: string): Promise<number | null> {
	try {
		const raw = await readFile(pidPath, "utf8");
		const pid = Number(raw.trim());
		if (!Number.isInteger(pid) || pid <= 0) return null;
		return pid;
	} catch {
		return null;
	}
}

function isRunning(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

async function daemonStatus(pidPath: string): Promise<GatewayRunResult> {
	const pid = await readPid(pidPath);
	if (!pid || !isRunning(pid)) {
		await rm(pidPath, { force: true });
		return {
			mode: "daemon",
			gatewayMode: "cli",
			running: false,
			channels: ["cli"],
			pid: null,
		};
	}
	return {
		mode: "daemon",
		gatewayMode: "cli",
		running: true,
		channels: ["cli"],
		pid,
	};
}

async function daemonStart(
	pidPath: string,
	entrypoint: string,
): Promise<GatewayRunResult> {
	const current = await daemonStatus(pidPath);
	if (current.running && current.pid) {
		return current;
	}
	await mkdir(dirname(pidPath), { recursive: true });
	const child = Bun.spawn(["bun", entrypoint, "gateway", "daemon-run"], {
		cwd: process.cwd(),
		env: process.env,
		stdin: "ignore",
		stdout: "ignore",
		stderr: "ignore",
		detached: true,
	});
	child.unref();
	await writeFile(pidPath, String(child.pid), "utf8");
	return {
		mode: "daemon",
		gatewayMode: "cli",
		running: true,
		channels: ["cli"],
		pid: child.pid,
	};
}

async function daemonStop(pidPath: string): Promise<GatewayRunResult> {
	const current = await daemonStatus(pidPath);
	if (current.running && current.pid) {
		try {
			process.kill(current.pid, "SIGTERM");
		} catch {
			// Process may have exited between status check and signal.
		}
	}
	await rm(pidPath, { force: true });
	return {
		mode: "daemon",
		gatewayMode: "cli",
		running: false,
		channels: ["cli"],
		pid: null,
	};
}

async function runDaemonAction(
	action: "start" | "stop" | "status",
	pidPath: string,
	entrypoint: string,
): Promise<GatewaySdkResult> {
	if (action === "status") {
		return { ok: true, data: await daemonStatus(pidPath) };
	}
	if (action === "start") {
		return { ok: true, data: await daemonStart(pidPath, entrypoint) };
	}
	return { ok: true, data: await daemonStop(pidPath) };
}

export async function run(input: GatewayRunInput): Promise<GatewaySdkResult> {
	const config = input.config ?? loadGatewayConfig();
	const action = input.action ?? "start";
	if (action === "status") {
		return {
			ok: true,
			data: {
				mode: "status",
				gatewayMode: config.mode,
				running: false,
				channels: ["cli"],
			},
		};
	}
	if (action === "daemon") {
		const pidPath =
			input.pidPath ?? join(process.cwd(), ".nooa", "gateway-daemon.pid");
		const entrypoint = input.entrypoint ?? "index.ts";
		return runDaemonAction(input.daemon ?? "status", pidPath, entrypoint);
	}
	const fallbackFactory =
		input.defaultRunnerFactory ??
		(async () => {
			// c8 ignore start
			const runDefaultAgent: GatewayRunner = async (sessionKey, content) => {
				const { run: runAgent } = await import("../agent/engine");
				const result = await runAgent({
					prompt: content,
					sessionKey,
				});
				if (result.ok) {
					return { forLlm: result.data.content };
				}
				return { forLlm: result.error.message };
			};
			return runDefaultAgent;
			// c8 ignore stop
		});
	const runner = input.runner ?? (await fallbackFactory());
	const bus = new EventBus();
	let lastOutbound: GatewayOutboundMessage | undefined;
	bus.on(GATEWAY_OUTBOUND_EVENT, (message: GatewayOutboundMessage) => {
		lastOutbound = message;
	});

	const gateway = new Gateway(bus, runner, { allowlist: config.allowlist });
	if (config.channels.cli.enabled) {
		const cliChannel = new CliChannel(bus);
		gateway.registerChannel(cliChannel);
	}
	await gateway.start();
	if (action === "daemon-run") {
		await new Promise<void>((resolve) => {
			let resolved = false;
			const onSigTerm = () => stop();
			const onSigInt = () => stop();
			const onAbort = () => stop();
			const stop = () => {
				if (resolved) return;
				resolved = true;
				process.off("SIGTERM", onSigTerm);
				process.off("SIGINT", onSigInt);
				input.signal?.removeEventListener("abort", onAbort);
				void gateway.stop().then(resolve);
			};
			process.on("SIGTERM", onSigTerm);
			process.on("SIGINT", onSigInt);
			input.signal?.addEventListener("abort", onAbort, { once: true });
			if (input.signal?.aborted) {
				stop();
			}
		});
		return {
			ok: true,
			data: {
				mode: "start",
				gatewayMode: config.mode,
				running: false,
				channels: gateway.listChannels(),
			},
		};
	}

	if (input.once) {
		const onceMessage = input.message ?? "healthcheck";
		const outboundPromise = new Promise<GatewayOutboundMessage>((resolve) => {
			const handler = (message: GatewayOutboundMessage) => {
				if (message.channel !== "cli") return;
				bus.off(GATEWAY_OUTBOUND_EVENT, handler);
				resolve(message);
			};
			bus.on(GATEWAY_OUTBOUND_EVENT, handler);
		});
		const inbound: GatewayInboundMessage = {
			channel: "cli",
			chatId: "cli:direct",
			senderId: "cli:user",
			content: onceMessage,
		};
		bus.emit(GATEWAY_INBOUND_EVENT, inbound);
		const outbound = await outboundPromise;
		await gateway.stop();
		return {
			ok: true,
			data: {
				mode: "start",
				gatewayMode: config.mode,
				running: false,
				channels: gateway.listChannels(),
				lastResponse: outbound.content ?? lastOutbound?.content,
			},
		};
	}

	await gateway.stop();
	return {
		ok: false,
		error: {
			code: "gateway.long_running_not_supported",
			message:
				"Long-running gateway mode is not enabled yet. Use --once for now.",
		},
	};
}
