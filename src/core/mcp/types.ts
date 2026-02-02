export interface McpServer {
	id: string;
	name: string;
	package?: string;
	command: string;
	args: string[];
	env?: Record<string, string>;
	enabled: boolean;
	installedAt?: number;
	updatedAt?: number;
}

export interface McpTool {
	name: string;
	description?: string;
	// biome-ignore lint/suspicious/noExplicitAny: MCP tool schemas are dynamic JSON objects
	inputSchema: any;
}

export interface McpResource {
	uri: string;
	name: string;
	mimeType?: string;
}

export interface McpPrompt {
	name: string;
	description?: string;
	// biome-ignore lint/suspicious/noExplicitAny: MCP tool arguments are dynamic
	arguments?: any[];
}

export type HealthStatusLevel = "healthy" | "degraded" | "down";

export interface HealthStatus {
	status: HealthStatusLevel;
	latency: number;
	lastCheck: number;
	reason?: string;
	lastError?: string;
}
