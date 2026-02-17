export const GATEWAY_INBOUND_EVENT = "gateway.inbound";
export const GATEWAY_OUTBOUND_EVENT = "gateway.outbound";

export interface GatewayInboundMessage {
	channel: string;
	chatId: string;
	senderId: string;
	content: string;
}

export interface GatewayOutboundMessage {
	channel: string;
	chatId: string;
	content: string;
}
