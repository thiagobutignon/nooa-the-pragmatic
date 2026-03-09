export type DesktopPermissionMode = "full_access" | "ask_first";

export type DesktopActionKind = "read" | "write" | "delete";

export interface DesktopActionRequest {
	requestId: string;
	kind: DesktopActionKind;
	path: string;
	content?: string;
	reason: string;
}

export type DesktopEvent =
	| {
			type: "assistant";
			markdown: string;
	  }
	| {
			type: "user";
			markdown: string;
	  }
	| {
			type: "tool_read";
			path: string;
			bytes: number;
			preview: string;
	  }
	| {
			type: "tool_write";
			path: string;
			bytes: number;
	  }
	| {
			type: "tool_delete";
			path: string;
	  }
	| {
			type: "approval_requested";
			request: DesktopActionRequest;
	  }
	| {
			type: "approval_resolved";
			requestId: string;
			approved: boolean;
	  }
	| {
			type: "error";
			message: string;
	  };

export interface DesktopBridgeResponse {
	sessionId: string;
	workspacePath: string;
	mode: DesktopPermissionMode;
	events: DesktopEvent[];
}

export type DesktopBridgeRequest =
	| {
			type: "send_message";
			sessionId: string;
			workspacePath: string;
			mode: DesktopPermissionMode;
			message: string;
	  }
	| {
			type: "approve" | "deny";
			sessionId: string;
			workspacePath: string;
			mode: DesktopPermissionMode;
	  };
