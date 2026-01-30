export type EventHandler<T = unknown> = (payload: T) => void;

type HandlerMap = Map<string, Set<EventHandler>>;

export class EventBus {
	private handlers: HandlerMap = new Map();

	on<T = unknown>(event: string, handler: EventHandler<T>) {
		const set = this.handlers.get(event) ?? new Set();
		set.add(handler as EventHandler);
		this.handlers.set(event, set);
	}

	off<T = unknown>(event: string, handler: EventHandler<T>) {
		const set = this.handlers.get(event);
		if (!set) return;
		set.delete(handler as EventHandler);
		if (set.size === 0) this.handlers.delete(event);
	}

	emit<T = unknown>(event: string, payload: T) {
		const set = this.handlers.get(event);
		if (!set) return;
		for (const handler of set) handler(payload);
	}
}
