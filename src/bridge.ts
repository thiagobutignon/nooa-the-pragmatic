import { readFile } from "node:fs/promises";

export const JobProviders = {
	arbeitnow: {
		specUrl: "https://www.arbeitnow.com/api/job-board-api", // This is just a placeholder, Arbeitnow actually uses a simple JSON API
		isJsonApi: true,
		baseUrl: "https://www.arbeitnow.com/api/job-board-api",
	},
};

export interface BridgeOptions {
	operationId: string;
	params: Record<string, string>;
	headers: Record<string, string>;
	envFile?: string;
}

export type OpenApiOperation = {
	operationId?: string;
	summary?: string;
};

export type OpenApiSpec = {
	swagger?: string;
	openapi?: string;
	info?: { title?: string };
	paths?: Record<string, Record<string, OpenApiOperation>>;
	servers?: Array<{ url?: string }>;
	host?: string;
	schemes?: string[];
	basePath?: string;
};

/**
 * Reconstructs a deep object from flattened dot-notation keys.
 * Example: "user.profile.name=Thiago" -> { user: { profile: { name: "Thiago" } } }
 */
export function reconstructObject(params: Record<string, string>): unknown {
	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(params)) {
		const parts = key.split(".");
		let current = result;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i] as string;
			if (i === parts.length - 1) {
				current[part] = value;
			} else {
				current[part] = (current[part] as Record<string, unknown>) || {};
				current = current[part] as Record<string, unknown>;
			}
		}
	}

	return result;
}

/**
 * Loads an OpenAPI spec from a URL or local path.
 */
export async function loadSpec(urlOrPath: string): Promise<OpenApiSpec> {
	if (urlOrPath.startsWith("http")) {
		const response = await fetch(urlOrPath);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch spec from ${urlOrPath}: ${response.statusText}`,
			);
		}
		return (await response.json()) as OpenApiSpec;
	}

	const content = await readFile(urlOrPath, "utf-8");
	return JSON.parse(content) as OpenApiSpec;
}

/**
 * Executes an API request based on the OpenAPI spec and provided options.
 */
export async function executeBridgeRequest(
	spec: OpenApiSpec,
	options: BridgeOptions,
) {
	const { operationId, params, headers } = options;

	// 1. Find the operation in the spec
	let foundPath: string | undefined;
	let foundMethod: string | undefined;
	let operation: OpenApiOperation | undefined;

	for (const [path, methods] of Object.entries(spec.paths ?? {})) {
		for (const [method, op] of Object.entries(methods)) {
			if (op.operationId === operationId) {
				foundPath = path;
				foundMethod = method;
				operation = op;
				break;
			}
		}
		if (operation) break;
	}

	if (!operation || !foundPath || !foundMethod) {
		throw new Error(`Operation with ID "${operationId}" not found in spec.`);
	}

	// 2. Resolve base URL (handle Swagger 2.0 and OpenAPI 3.x)
	let baseUrl = "";
	if (spec.servers?.[0]?.url) {
		baseUrl = spec.servers[0].url;
	} else if (spec.host) {
		const scheme = spec.schemes?.[0] || "https";
		const basePath = spec.basePath || "";
		baseUrl = `${scheme}://${spec.host}${basePath}`;
	}

	let url = `${baseUrl}${foundPath}`;
	const queryParams = new URLSearchParams();
	const requestHeaders: Record<string, string> = { ...headers };
	let requestBody: unknown;

	// Flattened params for reconstruction if needed
	const bodyParams: Record<string, string> = {};

	for (const [key, value] of Object.entries(params)) {
		// Check where this parameter belongs based on spec if possible,
		// but we'll use a pragmatic approach: if it's in the path, replace it.
		if (url.includes(`{${key}}`)) {
			url = url.replace(`{${key}}`, encodeURIComponent(value));
		} else {
			// For now, assume other params are query or body
			// If it's a POST/PUT/PATCH, we might want to put them in the body
			if (["post", "put", "patch"].includes(foundMethod.toLowerCase())) {
				bodyParams[key] = value;
			} else {
				queryParams.append(key, value);
			}
		}
	}

	if (Object.keys(bodyParams).length > 0) {
		requestBody = reconstructObject(bodyParams);
		requestHeaders["Content-Type"] = "application/json";
	}

	const queryString = queryParams.toString();
	const finalUrl = queryString
		? `${url}${url.includes("?") ? "&" : "?"}${queryString}`
		: url;

	// 3. Execute request
	const response = await fetch(finalUrl, {
		method: foundMethod.toUpperCase(),
		headers: requestHeaders,
		body: requestBody ? JSON.stringify(requestBody) : undefined,
	});

	const contentType = response.headers.get("content-type");
	const isJson = contentType?.includes("application/json");

	return {
		status: response.status,
		statusText: response.statusText,
		headers: Object.fromEntries(response.headers.entries()),
		data: isJson ? await response.json() : await response.text(),
	};
}
