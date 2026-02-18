import { describe, expect, test } from "bun:test";
import { loadGatewayConfig } from "./config";

describe("gateway config", () => {
	test("loads defaults", () => {
		const config = loadGatewayConfig({});

		expect(config.mode).toBe("cli");
		expect(config.transport).toBe("polling");
		expect(config.allowlist).toEqual([]);
		expect(config.host).toBe("127.0.0.1");
		expect(config.port).toBe(0);
		expect(config.channels.cli.enabled).toBe(true);
		expect(config.channels.telegram.enabled).toBe(false);
		expect(config.channels.discord.enabled).toBe(false);
	});

	test("supports env overrides", () => {
		const config = loadGatewayConfig({
			NOOA_GATEWAY_MODE: "cli",
			NOOA_GATEWAY_TRANSPORT: "webhook",
			NOOA_GATEWAY_ALLOWLIST: "alice,bob",
			NOOA_GATEWAY_HOST: "0.0.0.0",
			NOOA_GATEWAY_PORT: "3000",
			NOOA_CHANNELS_CLI_TOKEN: "cli-token",
			NOOA_CHANNELS_CLI_ENABLED: "0",
		});

		expect(config.transport).toBe("webhook");
		expect(config.allowlist).toEqual(["alice", "bob"]);
		expect(config.host).toBe("0.0.0.0");
		expect(config.port).toBe(3000);
		expect(config.channels.cli.token).toBe("cli-token");
		expect(config.channels.cli.enabled).toBe(false);
	});

	test("throws for invalid enum values", () => {
		expect(() => loadGatewayConfig({ NOOA_GATEWAY_MODE: "sms" })).toThrow(
			"NOOA_GATEWAY_MODE",
		);
		expect(() =>
			loadGatewayConfig({ NOOA_GATEWAY_TRANSPORT: "carrier-pigeon" }),
		).toThrow("NOOA_GATEWAY_TRANSPORT");
	});
});
