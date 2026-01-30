import type { EventBus } from "./event-bus";

export interface CommandContext {
    args: string[];
    values: Record<string, unknown>;
    bus: EventBus;
}

export interface Command {
    name: string;
    description: string;
    execute: (context: CommandContext) => Promise<void>;
}
