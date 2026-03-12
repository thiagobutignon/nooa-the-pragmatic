export type DesktopPermissionMode = "full_access" | "ask_first";

export type DesktopActionKind = "read" | "write" | "delete";

export interface DesktopActionRequest {
	requestId: string;
	kind: DesktopActionKind;
	path: string;
	content?: string;
	reason: string;
}

export interface DesktopChatMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

export interface DesktopSessionState {
	sessionId: string;
	workspacePath: string;
	mode: DesktopPermissionMode;
	title?: string;
	archived?: boolean;
	createdAt?: string;
	updatedAt?: string;
	history: DesktopChatMessage[];
	events: DesktopEvent[];
	pendingApproval: DesktopActionRequest | null;
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

export interface DesktopWorkspaceEntry {
	path: string;
	lastOpenedAt: string;
	lastSessionId: string | null;
}

export interface DesktopConversationEntry {
	sessionId: string;
	workspacePath: string;
	title: string;
	archived: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface DesktopBootstrapResponse {
	recentWorkspaces: DesktopWorkspaceEntry[];
	conversations: DesktopConversationEntry[];
	session: DesktopBridgeResponse | null;
}

export type DesktopBridgeRequest =
	| {
			type: "bootstrap";
			workspacePath?: string;
	  }
	| {
			type: "new_session";
			workspacePath: string;
			mode: DesktopPermissionMode;
	  }
	| {
			type: "open_session";
			workspacePath: string;
			sessionId: string;
			mode: DesktopPermissionMode;
	  }
	| {
			type: "archive_session";
			workspacePath: string;
			sessionId: string;
	  }
	| {
			type: "delete_session";
			workspacePath: string;
			sessionId: string;
	  }
	| {
			type: "forget_workspace";
			workspacePath: string;
	  }
	| {
			type: "send_message";
			sessionId: string;
			workspacePath: string;
			mode: DesktopPermissionMode;
			message: string;
	  }
	| {
			type: "approve";
			sessionId: string;
			workspacePath: string;
			mode: DesktopPermissionMode;
			requestId: string;
	  }
	| {
			type: "deny";
			sessionId: string;
			workspacePath: string;
			mode: DesktopPermissionMode;
			requestId: string;
	  };
