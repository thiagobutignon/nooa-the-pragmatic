import type { EventBus, EventHandler } from "../../core/event-bus";
import {
	GATEWAY_INBOUND_EVENT,
	GATEWAY_OUTBOUND_EVENT,
	type GatewayInboundMessage,
	type GatewayOutboundMessage,
} from "../gateway/messages";
import type { Channel } from "./channel";

export class CliChannel implements Channel {
	readonly name = "cli";
	private outboundHandler?: EventHandler<GatewayOutboundMessage>;

	constructor(
		private readonly bus: EventBus,
		private readonly chatId = "cli:direct",
		private readonly senderId = "cli:user",
	) {}

	handleInput(content: string): void {
		const message: GatewayInboundMessage = {
			channel: this.name,
			chatId: this.chatId,
			senderId: this.senderId,
			content,
		};
		this.bus.emit(GATEWAY_INBOUND_EVENT, message);
	}

	start(): void {
		if (this.outboundHandler) return;
		this.outboundHandler = (message) => {
			if (message.channel !== this.name) return;
			console.log(message.content);
		};
		this.bus.on(GATEWAY_OUTBOUND_EVENT, this.outboundHandler);
	}

	stop(): void {
		if (!this.outboundHandler) return;
		this.bus.off(GATEWAY_OUTBOUND_EVENT, this.outboundHandler);
		this.outboundHandler = undefined;
	}

	send(message: GatewayOutboundMessage): void {
		if (message.channel !== this.name) return;
		console.log(message.content);
	}
}
