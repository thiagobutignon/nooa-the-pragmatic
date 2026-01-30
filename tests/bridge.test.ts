import { afterEach, beforeAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const fsMocks = {
	readFile: async () => "",
};

mock.module("node:fs/promises", () => fsMocks);

let executeBridgeRequest: typeof import("../src/bridge").executeBridgeRequest;
let reconstructObject: typeof import("../src/bridge").reconstructObject;
let loadSpec: typeof import("../src/bridge").loadSpec;

beforeAll(async () => {
	const bridge = await import("../src/bridge");
	executeBridgeRequest = bridge.executeBridgeRequest;
	reconstructObject = bridge.reconstructObject;
	loadSpec = bridge.loadSpec;
});

describe("Nooa Bridge Logic", () => {
	describe("reconstructObject", () => {
		it("should reconstruct flat objects", () => {
			const input = { name: "Thiago", role: "Dev" };
			const result = reconstructObject(input);
			expect(result).toEqual({ name: "Thiago", role: "Dev" });
		});

		it("should reconstruct nested objects using dot notation", () => {
			const input = {
				"user.name": "Thiago",
				"user.contact.email": "me@email.com",
				"settings.theme": "dark",
			};
			const result = reconstructObject(input);
			expect(result).toEqual({
				user: {
					name: "Thiago",
					contact: {
						email: "me@email.com",
					},
				},
				settings: {
					theme: "dark",
				},
			});
		});
	});

	describe("loadSpec", () => {
		let fetchSpy: ReturnType<typeof spyOn>;

		beforeEach(() => {
			fetchSpy = spyOn(globalThis, "fetch");
		});

		afterEach(() => {
			fetchSpy.mockRestore();
			mock.clearAllMocks();
		});

		it("should load spec from HTTP URL", async () => {
			fetchSpy.mockResolvedValue({
				ok: true,
				json: async () => ({ openapi: "3.0.0" }),
			} as Response);

			const spec = await loadSpec("https://example.com/spec.json");

			expect(fetch).toHaveBeenCalledWith("https://example.com/spec.json");
			expect(spec).toEqual({ openapi: "3.0.0" });
		});

		it("should throw if HTTP fetch fails", async () => {
			fetchSpy.mockResolvedValue({
				ok: false,
				statusText: "Not Found",
			} as Response);

			await expect(loadSpec("https://example.com/404.json")).rejects.toThrow(
				"Failed to fetch spec from https://example.com/404.json: Not Found",
			);
		});

		it("should throw if local file read fails", async () => {
			await expect(loadSpec("/invalid/path.json")).rejects.toThrow("JSON Parse error");
		});
	});

	describe("executeBridgeRequest", () => {
		const mockSpec = {
			openapi: "3.0.0",
			servers: [{ url: "https://api.test.com" }],
			paths: {
				"/users/{id}": {
					get: {
						operationId: "getUser",
					},
				},
				"/users": {
					post: {
						operationId: "createUser",
					},
				},
			},
		};

		let fetchSpy: ReturnType<typeof spyOn>;

		beforeEach(() => {
			fetchSpy = spyOn(globalThis, "fetch");
		});

		afterEach(() => {
			fetchSpy.mockRestore();
			mock.clearAllMocks();
		});

		it("should execute a GET request with path and query parameters", async () => {
			fetchSpy.mockResolvedValue({
				ok: true,
				status: 200,
				headers: new Headers({ "content-type": "application/json" }),
				json: async () => ({ id: "123", name: "Thiago" }),
			} as Response);

			const options = {
				operationId: "getUser",
				params: { id: "123", fields: "name,email" },
				headers: { Authorization: "Bearer token" },
			};

			const result = await executeBridgeRequest(mockSpec, options);

			expect(fetch).toHaveBeenCalledWith(
				"https://api.test.com/users/123?fields=name%2Cemail",
				expect.objectContaining({
					method: "GET",
					headers: expect.objectContaining({
						Authorization: "Bearer token",
					}),
				}),
			);
			expect(result.data).toEqual({ id: "123", name: "Thiago" });
		});

		it("should execute a POST request with reconstructed body", async () => {
			fetchSpy.mockResolvedValue({
				ok: true,
				status: 201,
				headers: new Headers({ "content-type": "application/json" }),
				json: async () => ({ success: true }),
			} as Response);

			const options = {
				operationId: "createUser",
				params: { "user.name": "Ana", "user.email": "ana@test.com" },
				headers: {},
			};

			const result = await executeBridgeRequest(mockSpec, options);

			expect(fetch).toHaveBeenCalledWith(
				"https://api.test.com/users",
				expect.objectContaining({ method: "POST" }),
			);
			expect(result.data).toEqual({ success: true });
		});

		it("should throw error if operationId is not found", async () => {
			await expect(
				executeBridgeRequest(mockSpec, {
					operationId: "missing",
					params: {},
					headers: {},
				}),
			).rejects.toThrow("Operation with ID \"missing\" not found in spec.");
		});

		it("should support Swagger 2.0 host and schemes resolution", async () => {
			const swaggerSpec = {
				swagger: "2.0",
				host: "api.swag.com",
				schemes: ["https"],
				paths: {
					"/ping": {
						get: { operationId: "ping" },
					},
				},
			};

			fetchSpy.mockResolvedValue({
				ok: true,
				status: 200,
				headers: new Headers({ "content-type": "application/json" }),
				json: async () => ({ ok: true }),
			} as Response);

			const result = await executeBridgeRequest(swaggerSpec as any, {
				operationId: "ping",
				params: {},
				headers: {},
			});

			expect(fetch).toHaveBeenCalledWith(
				"https://api.swag.com/ping",
				expect.objectContaining({ method: "GET" }),
			);
			expect(result.data).toEqual({ ok: true });
		});
	});
});
