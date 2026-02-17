import { describe, expect, test } from "bun:test";
import {
	GATEWAY_INBOUND_EVENT,
	GATEWAY_OUTBOUND_EVENT,
	type GatewayInboundMessage,
	type GatewayOutboundMessage,
} from "./messages";

describe("gateway message contracts", () => {
	test("defines inbound message shape", () => {
		const msg: GatewayInboundMessage = {
			channel: "telegram",
			chatId: "123",
			senderId: "user-1",
			content: "hello",
		};

		expect(msg.channel).toBe("telegram");
		expect(GATEWAY_INBOUND_EVENT).toBe("gateway.inbound");
	});

	test("defines outbound message shape", () => {
		const msg: GatewayOutboundMessage = {
			channel: "telegram",
			chatId: "123",
			content: "world",
		};

		expect(msg.content).toBe("world");
		expect(GATEWAY_OUTBOUND_EVENT).toBe("gateway.outbound");
	});
});
