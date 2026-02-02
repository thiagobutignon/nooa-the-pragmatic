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
	arguments?: any[];
}
