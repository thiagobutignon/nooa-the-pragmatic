import type { GatewayOutboundMessage } from "../gateway/messages";

export interface Channel {
	name: string;
	start(): Promise<void> | void;
	stop(): Promise<void> | void;
	send(message: GatewayOutboundMessage): Promise<void> | void;
}
