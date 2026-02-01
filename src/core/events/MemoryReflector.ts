import { Reflector } from "../../features/memory/reflect";
import type { EventBus } from "../event-bus";
import type { TelemetryEvent } from "../telemetry";

export class MemoryReflector {
	private reflector: Reflector;
	private pending: Promise<any>[] = [];

	constructor(bus: EventBus, reflector?: Reflector) {
		this.reflector = reflector || new Reflector();
		bus.on<TelemetryEvent>("telemetry.tracked", (event) => {
			const promise = this.reflector.reflect(event).catch(() => {});
			this.pending.push(promise);
		});
	}

	async flush() {
		await Promise.all(this.pending);
		this.pending = [];
	}
}
