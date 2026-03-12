type PendingRequest = {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
};

export class DebugCdpClient {
	private ws: WebSocket;
	private nextId = 1;
	private pending = new Map<number, PendingRequest>();
	private listeners = new Map<string, Set<(params: unknown) => void>>();

	private constructor(ws: WebSocket) {
		this.ws = ws;
		this.setupHandlers();
	}

	static async connect(wsUrl: string): Promise<DebugCdpClient> {
		return await new Promise((resolve, reject) => {
			const ws = new WebSocket(wsUrl);

			const onOpen = () => {
				ws.removeEventListener("error", onError);
				resolve(new DebugCdpClient(ws));
			};

			const onError = (event: Event) => {
				ws.removeEventListener("open", onOpen);
				const message =
					event instanceof ErrorEvent ? event.message : "WebSocket connection failed";
				reject(new Error(message));
			};

			ws.addEventListener("open", onOpen, { once: true });
			ws.addEventListener("error", onError, { once: true });
		});
	}

	async send(method: string, params?: Record<string, unknown>): Promise<unknown> {
		const id = this.nextId++;
		const payload = JSON.stringify({
			id,
			method,
			...(params ? { params } : {}),
		});

		return await new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`CDP request timed out: ${method}`));
			}, 3000);

			this.pending.set(id, { resolve, reject, timer });
			this.ws.send(payload);
		});
	}

	on(event: string, handler: (params: unknown) => void): void {
		const handlers = this.listeners.get(event) ?? new Set();
		handlers.add(handler);
		this.listeners.set(event, handlers);
	}

	off(event: string, handler: (params: unknown) => void): void {
		const handlers = this.listeners.get(event);
		if (!handlers) return;
		handlers.delete(handler);
		if (handlers.size === 0) {
			this.listeners.delete(event);
		}
	}

	async waitFor(event: string, timeoutMs = 1000): Promise<unknown> {
		return await new Promise((resolve, reject) => {
			const handler = (params: unknown) => {
				clearTimeout(timer);
				this.off(event, handler);
				resolve(params);
			};

			const timer = setTimeout(() => {
				this.off(event, handler);
				reject(new Error(`Timed out waiting for event: ${event}`));
			}, timeoutMs);

			this.on(event, handler);
		});
	}

	disconnect(): void {
		for (const pending of this.pending.values()) {
			clearTimeout(pending.timer);
			pending.reject(new Error("CDP client disconnected"));
		}
		this.pending.clear();
		this.listeners.clear();
		this.ws.close();
	}

	private setupHandlers(): void {
		this.ws.addEventListener("message", (event: MessageEvent) => {
			const data = typeof event.data === "string" ? event.data : String(event.data);
			const parsed = JSON.parse(data) as {
				id?: number;
				method?: string;
				params?: unknown;
				result?: unknown;
				error?: { message?: string; code?: number };
			};

			if (typeof parsed.id === "number") {
				const pending = this.pending.get(parsed.id);
				if (!pending) return;
				clearTimeout(pending.timer);
				this.pending.delete(parsed.id);
				if (parsed.error) {
					pending.reject(
						new Error(
							`CDP error (${parsed.error.code ?? "unknown"}): ${parsed.error.message ?? "unknown"}`,
						),
					);
					return;
				}
				pending.resolve(parsed.result);
				return;
			}

			if (parsed.method) {
				const handlers = this.listeners.get(parsed.method);
				if (!handlers) return;
				for (const handler of handlers) {
					handler(parsed.params);
				}
			}
		});
	}
}
