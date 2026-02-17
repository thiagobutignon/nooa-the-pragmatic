import { describe, expect, mock, test } from "bun:test";
import { EventBus } from "../../core/event-bus";
import {
	GATEWAY_INBOUND_EVENT,
	GATEWAY_OUTBOUND_EVENT,
	type GatewayInboundMessage,
	type GatewayOutboundMessage,
} from "../gateway/messages";
import { CliChannel } from "./cli-channel";

describe("CliChannel", () => {
	test("has name cli", () => {
		const channel = new CliChannel(new EventBus());
		expect(channel.name).toBe("cli");
	});

	test("publishes inbound message on input", () => {
		const bus = new EventBus();
		const channel = new CliChannel(bus);
		const inboundHandler = mock((_msg: GatewayInboundMessage) => {});
		bus.on(GATEWAY_INBOUND_EVENT, inboundHandler);

		channel.handleInput("hello");

		expect(inboundHandler).toHaveBeenCalledTimes(1);
		expect(inboundHandler.mock.calls[0]?.[0]).toMatchObject({
			channel: "cli",
			content: "hello",
		});
	});

	test("prints outbound content for cli channel", () => {
		const bus = new EventBus();
		const channel = new CliChannel(bus);
		const spy = mock(() => {});
		const originalLog = console.log;
		console.log = spy as typeof console.log;
		try {
			channel.start();
			const outbound: GatewayOutboundMessage = {
				channel: "cli",
				chatId: "cli:direct",
				content: "done",
			};
			bus.emit(GATEWAY_OUTBOUND_EVENT, outbound);
		} finally {
			console.log = originalLog;
		}

		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0]?.[0]).toContain("done");
	});

	test("send ignores other channels and stop unsubscribes", () => {
		const bus = new EventBus();
		const channel = new CliChannel(bus);
		const spy = mock(() => {});
		const originalLog = console.log;
		console.log = spy as typeof console.log;
		try {
			channel.start();
			channel.send({ channel: "telegram", chatId: "1", content: "skip" });
			channel.send({ channel: "cli", chatId: "1", content: "deliver" });
			channel.stop();
			bus.emit(GATEWAY_OUTBOUND_EVENT, {
				channel: "cli",
				chatId: "1",
				content: "after-stop",
			});
		} finally {
			console.log = originalLog;
		}

		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0]?.[0]).toContain("deliver");
	});
});
