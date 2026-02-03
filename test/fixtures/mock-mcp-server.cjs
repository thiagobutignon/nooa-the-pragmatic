// Simulated MCP server for testing
// Implements core JSON-RPC MCP protocol over stdio

const { createInterface } = require("node:readline");

const rl = createInterface({
	input: process.stdin,
	output: process.stdout,
});

const tools = [
	{
		name: "echo",
		description: "Echo back a message",
		inputSchema: {
			type: "object",
			properties: {
				message: { type: "string" },
			},
		},
	},
	{
		name: "add",
		description: "Add two numbers",
		inputSchema: {
			type: "object",
			properties: {
				a: { type: "number" },
				b: { type: "number" },
			},
		},
	},
];

const resources = [
	{
		uri: "test://sample",
		name: "Sample Resource",
		mimeType: "text/plain",
	},
];

rl.on("line", (line) => {
	try {
		const request = JSON.parse(line);

		const response = {
			jsonrpc: "2.0",
			id: request.id,
		};

		switch (request.method) {
			case "initialize":
				response.result = {
					protocolVersion: "2024-11-05",
					capabilities: {
						tools: {},
						resources: {},
					},
					serverInfo: {
						name: "simulated-mcp-server",
						version: "1.0.0",
					},
				};
				break;

			case "tools/list":
				response.result = { tools };
				break;

			case "tools/call": {
				const toolName = request.params.name;
				const args = request.params.arguments || {};

				if (toolName === "echo") {
					response.result = {
						content: [
							{
								type: "text",
								text: args.message || "",
							},
						],
					};
				} else if (toolName === "add") {
					response.result = {
						content: [
							{
								type: "text",
								text: String((args.a || 0) + (args.b || 0)),
							},
						],
					};
				} else {
					response.error = {
						code: -32601,
						message: `Tool not found: ${toolName}`,
					};
				}
				break;
			}

			case "resources/list":
				response.result = { resources };
				break;

			case "resources/read":
				response.result = {
					contents: [
						{
							uri: request.params.uri,
							mimeType: "text/plain",
							text: "Sample resource content",
						},
					],
				};
				break;

			case "ping":
				response.result = {};
				break;

			default:
				response.error = {
					code: -32601,
					message: `Method not found: ${request.method}`,
				};
		}

		console.log(JSON.stringify(response));
	} catch (error) {
		console.error("Error processing request:", error);
	}
});
