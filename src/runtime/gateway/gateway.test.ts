import { describe, expect, mock, test } from "bun:test";
import { EventBus } from "../../core/event-bus";
import { CliChannel } from "../channels/cli-channel";
import { Gateway } from "./gateway";
import {
	GATEWAY_INBOUND_EVENT,
	GATEWAY_OUTBOUND_EVENT,
	type GatewayInboundMessage,
	type GatewayOutboundMessage,
} from "./messages";

describe("Gateway", () => {
	test("registers a channel", () => {
		const bus = new EventBus();
		const runner = mock(async () => ({ forLlm: "ok" }));
		const gateway = new Gateway(bus, runner);

		gateway.registerChannel({
			name: "test",
			start: mock(async () => {}),
			stop: mock(async () => {}),
			send: mock(async () => {}),
		});

		expect(gateway.listChannels()).toContain("test");
	});

	test("starts and stops all channels", async () => {
		const bus = new EventBus();
		const runner = mock(async () => ({ forLlm: "ok" }));
		const start = mock(async () => {});
		const stop = mock(async () => {});
		const gateway = new Gateway(bus, runner);
		gateway.registerChannel({
			name: "test",
			start,
			stop,
			send: mock(async () => {}),
		});

		await gateway.start();
		await gateway.stop();

		expect(start).toHaveBeenCalledTimes(1);
		expect(stop).toHaveBeenCalledTimes(1);
	});

	test("processes inbound events via runner and emits outbound", async () => {
		const bus = new EventBus();
		const runner = mock(async (sessionKey: string, content: string) => ({
			forLlm: `echo:${sessionKey}:${content}`,
		}));
		const gateway = new Gateway(bus, runner);
		const outboundHandler = mock((_msg: GatewayOutboundMessage) => {});
		bus.on(GATEWAY_OUTBOUND_EVENT, outboundHandler);
		await gateway.start();

		const inbound: GatewayInboundMessage = {
			channel: "cli",
			chatId: "chat-1",
			senderId: "user-1",
			content: "hello",
		};
		bus.emit(GATEWAY_INBOUND_EVENT, inbound);
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(runner).toHaveBeenCalledTimes(1);
		expect(outboundHandler).toHaveBeenCalledTimes(1);
		expect(outboundHandler.mock.calls[0]?.[0]).toMatchObject({
			channel: "cli",
			chatId: "chat-1",
		});
	});

	test("emits fallback outbound when runner throws", async () => {
		const bus = new EventBus();
		const runner = mock(async () => {
			throw new Error("boom");
		});
		const gateway = new Gateway(bus, runner);
		const outboundHandler = mock((_msg: GatewayOutboundMessage) => {});
		bus.on(GATEWAY_OUTBOUND_EVENT, outboundHandler);
		await gateway.start();

		bus.emit(GATEWAY_INBOUND_EVENT, {
			channel: "cli",
			chatId: "chat-2",
			senderId: "user-2",
			content: "hello",
		});
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(outboundHandler).toHaveBeenCalledTimes(1);
		expect(outboundHandler.mock.calls[0]?.[0]).toMatchObject({
			channel: "cli",
			chatId: "chat-2",
			content: "boom",
		});
	});

	test("does not duplicate cli outbound logs", async () => {
		const bus = new EventBus();
		const runner = mock(async () => ({ forLlm: "single-output" }));
		const gateway = new Gateway(bus, runner);
		const cli = new CliChannel(bus);
		gateway.registerChannel(cli);
		const logSpy = mock(() => {});
		const originalLog = console.log;
		console.log = logSpy as typeof console.log;
		try {
			await gateway.start();
			bus.emit(GATEWAY_INBOUND_EVENT, {
				channel: "cli",
				chatId: "chat-dup",
				senderId: "user-dup",
				content: "hello",
			});
			await new Promise((resolve) => setTimeout(resolve, 0));
		} finally {
			console.log = originalLog;
		}

		expect(logSpy).toHaveBeenCalledTimes(1);
		expect(logSpy.mock.calls[0]?.[0]).toContain("single-output");
	});

	test("blocks inbound message when sender is not in allowlist", async () => {
		const bus = new EventBus();
		const runner = mock(async () => ({ forLlm: "must-not-run" }));
		const gateway = new Gateway(bus, runner, { allowlist: ["allowed-user"] });
		const outboundHandler = mock((_msg: GatewayOutboundMessage) => {});
		bus.on(GATEWAY_OUTBOUND_EVENT, outboundHandler);
		await gateway.start();

		bus.emit(GATEWAY_INBOUND_EVENT, {
			channel: "cli",
			chatId: "chat-blocked",
			senderId: "blocked-user",
			content: "hello",
		});
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(runner).toHaveBeenCalledTimes(0);
		expect(outboundHandler).toHaveBeenCalledTimes(1);
		expect(outboundHandler.mock.calls[0]?.[0]).toMatchObject({
			channel: "cli",
			chatId: "chat-blocked",
			content: "ignored_by_allowlist",
		});
	});
});
