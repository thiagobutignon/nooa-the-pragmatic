import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeBridgeRequest, reconstructObject } from "../src/bridge";

vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(),
}));

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
		beforeEach(() => {
			vi.stubGlobal("fetch", vi.fn());
		});

		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it("should load spec from HTTP URL", async () => {
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => ({ openapi: "3.0.0" }),
			} as Response);

			const { loadSpec } = await import("../src/bridge");
			const spec = await loadSpec("https://example.com/spec.json");

			expect(fetch).toHaveBeenCalledWith("https://example.com/spec.json");
			expect(spec).toEqual({ openapi: "3.0.0" });
		});

		it("should throw if HTTP fetch fails", async () => {
			vi.mocked(fetch).mockResolvedValue({
				ok: false,
				statusText: "Not Found",
			} as Response);

			const { loadSpec } = await import("../src/bridge");
			await expect(loadSpec("https://example.com/404.json")).rejects.toThrow(
				"Failed to fetch spec from https://example.com/404.json: Not Found",
			);
		});

		it("should throw if local file read fails", async () => {
			const { readFile } = await import("node:fs/promises");
			vi.mocked(readFile).mockRejectedValueOnce(new Error("Read Error"));

			const { loadSpec } = await import("../src/bridge");
			await expect(loadSpec("/invalid/path.json")).rejects.toThrow("Read Error");
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

		beforeEach(() => {
			vi.stubGlobal("fetch", vi.fn());
		});

		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it("should execute a GET request with path and query parameters", async () => {
			vi.mocked(fetch).mockResolvedValue({
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
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				status: 201,
				headers: new Headers({ "content-type": "application/json" }),
				json: async () => ({ success: true }),
			} as Response);

			const options = {
				operationId: "createUser",
				params: { "user.name": "Thiago", "user.role": "Admin" },
				headers: {},
			};

			await executeBridgeRequest(mockSpec, options);

			expect(fetch).toHaveBeenCalledWith(
				"https://api.test.com/users",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ user: { name: "Thiago", role: "Admin" } }),
					headers: expect.objectContaining({
						"Content-Type": "application/json",
					}),
				}),
			);
		});

		it("should throw error if operationId is not found", async () => {
			const options = {
				operationId: "nonExistent",
				params: {},
				headers: {},
			};

			await expect(executeBridgeRequest(mockSpec, options)).rejects.toThrow(
				'Operation with ID "nonExistent" not found in spec.',
			);
		});

		it("should support Swagger 2.0 host and schemes resolution", async () => {
			const swagger2Spec = {
				swagger: "2.0",
				host: "petstore.swagger.io",
				basePath: "/v2",
				schemes: ["https"],
				paths: {
					"/pet/{petId}": {
						get: { operationId: "getPet" },
					},
				},
			};

			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				status: 200,
				headers: new Headers({ "content-type": "application/json" }),
				json: async () => ({}),
				text: async () => "{}",
			} as Response);

			await executeBridgeRequest(swagger2Spec, {
				operationId: "getPet",
				params: { petId: "1" },
				headers: {},
			});

			expect(fetch).toHaveBeenCalledWith(
				"https://petstore.swagger.io/v2/pet/1",
				expect.anything(),
			);
		});
	});
});
