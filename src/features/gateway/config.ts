export type GatewayMode = "cli";
export type GatewayTransport = "polling" | "webhook";

export interface GatewayChannelConfig {
	enabled: boolean;
	token?: string;
}

export interface GatewayConfig {
	mode: GatewayMode;
	transport: GatewayTransport;
	allowlist: string[];
	host: string;
	port: number;
	channels: {
		cli: GatewayChannelConfig;
		telegram: GatewayChannelConfig;
		discord: GatewayChannelConfig;
	};
}

type EnvMap = Record<string, string | undefined>;

function parseMode(value: string | undefined): GatewayMode {
	const normalized = value ?? "cli";
	if (normalized !== "cli") {
		throw new Error("Invalid NOOA_GATEWAY_MODE. Allowed: cli");
	}
	return normalized;
}

function parseTransport(value: string | undefined): GatewayTransport {
	const normalized = value ?? "polling";
	if (normalized !== "polling" && normalized !== "webhook") {
		throw new Error(
			"Invalid NOOA_GATEWAY_TRANSPORT. Allowed: polling, webhook",
		);
	}
	return normalized;
}

function parseAllowlist(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function parseBoolean(
	value: string | undefined,
	defaultValue: boolean,
): boolean {
	if (value === undefined || value === "") return defaultValue;
	const normalized = value.toLowerCase();
	if (["1", "true", "yes", "on"].includes(normalized)) return true;
	if (["0", "false", "no", "off"].includes(normalized)) return false;
	return defaultValue;
}

function parsePort(value: string | undefined): number {
	if (!value) return 0;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
		throw new Error("Invalid NOOA_GATEWAY_PORT. Expected integer 0..65535");
	}
	return parsed;
}

export function loadGatewayConfig(env: EnvMap = process.env): GatewayConfig {
	return {
		mode: parseMode(env.NOOA_GATEWAY_MODE),
		transport: parseTransport(env.NOOA_GATEWAY_TRANSPORT),
		allowlist: parseAllowlist(env.NOOA_GATEWAY_ALLOWLIST),
		host: env.NOOA_GATEWAY_HOST || "127.0.0.1",
		port: parsePort(env.NOOA_GATEWAY_PORT),
		channels: {
			cli: {
				enabled: parseBoolean(env.NOOA_CHANNELS_CLI_ENABLED, true),
				token: env.NOOA_CHANNELS_CLI_TOKEN,
			},
			telegram: {
				enabled: parseBoolean(env.NOOA_CHANNELS_TELEGRAM_ENABLED, false),
				token: env.NOOA_CHANNELS_TELEGRAM_TOKEN,
			},
			discord: {
				enabled: parseBoolean(env.NOOA_CHANNELS_DISCORD_ENABLED, false),
				token: env.NOOA_CHANNELS_DISCORD_TOKEN,
			},
		},
	};
}
