import type { EventBus, EventHandler } from "../../core/event-bus";
import type { Channel } from "../channels/channel";
import {
	GATEWAY_INBOUND_EVENT,
	GATEWAY_OUTBOUND_EVENT,
	type GatewayInboundMessage,
	type GatewayOutboundMessage,
} from "./messages";

interface GatewayRunnerResult {
	forLlm: string;
	forUser?: string;
}

export type GatewayRunner = (
	sessionKey: string,
	content: string,
) => Promise<GatewayRunnerResult>;

export class Gateway {
	private readonly channels = new Map<string, Channel>();
	private inboundHandler?: EventHandler<GatewayInboundMessage>;
	private running = false;

	constructor(
		private readonly bus: EventBus,
		private readonly runner: GatewayRunner,
	) {}

	registerChannel(channel: Channel): void {
		this.channels.set(channel.name, channel);
	}

	listChannels(): string[] {
		return [...this.channels.keys()];
	}

	private buildSessionKey(message: GatewayInboundMessage): string {
		return `${message.channel}:${message.chatId}`;
	}

	private async processInbound(message: GatewayInboundMessage): Promise<void> {
		const sessionKey = this.buildSessionKey(message);
		const result = await this.runner(sessionKey, message.content);
		const outbound: GatewayOutboundMessage = {
			channel: message.channel,
			chatId: message.chatId,
			content: result.forUser ?? result.forLlm,
		};
		this.bus.emit(GATEWAY_OUTBOUND_EVENT, outbound);
	}

	async start(): Promise<void> {
		if (this.running) return;
		this.running = true;
		this.inboundHandler = (message) => {
			void this.processInbound(message).catch((error) => {
				const content =
					error instanceof Error ? error.message : "Gateway processing failed";
				this.bus.emit(GATEWAY_OUTBOUND_EVENT, {
					channel: message.channel,
					chatId: message.chatId,
					content,
				});
			});
		};
		this.bus.on(GATEWAY_INBOUND_EVENT, this.inboundHandler);
		for (const channel of this.channels.values()) {
			await channel.start();
		}
	}

	async stop(): Promise<void> {
		if (!this.running) return;
		this.running = false;
		if (this.inboundHandler) {
			this.bus.off(GATEWAY_INBOUND_EVENT, this.inboundHandler);
			this.inboundHandler = undefined;
		}
		for (const channel of this.channels.values()) {
			await channel.stop();
		}
	}
}
