import { expect, test } from "bun:test";
import type { McpPrompt, McpResource, McpServer, McpTool } from "./types";

test("McpServer type is defined", () => {
	const server: McpServer = {
		id: "test",
		name: "test-server",
		package: "@test/server",
		command: "node",
		args: ["server.js"],
		enabled: true,
	};
	expect(server.name).toBe("test-server");
	expect(server.enabled).toBe(true);
});

test("McpTool type is defined", () => {
	const tool: McpTool = {
		name: "read_file",
		description: "Read a file from filesystem",
		inputSchema: {
			type: "object",
			properties: {
				path: { type: "string" },
			},
		},
	};
	expect(tool.name).toBe("read_file");
	expect(tool.inputSchema).toBeDefined();
});

test("McpResource type is defined", () => {
	const resource: McpResource = {
		uri: "file:///workspace/README.md",
		name: "README",
		mimeType: "text/markdown",
	};
	expect(resource.uri).toBe("file:///workspace/README.md");
	expect(resource.mimeType).toBe("text/markdown");
});

test("McpPrompt type is defined", () => {
	const prompt: McpPrompt = {
		name: "code_review",
		description: "Review code for best practices",
		arguments: [{ name: "file", description: "File to review" }],
	};
	expect(prompt.name).toBe("code_review");
	expect(prompt.arguments).toBeDefined();
});
