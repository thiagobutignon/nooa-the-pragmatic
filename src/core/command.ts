import type { EventBus } from "./event-bus";
import type { AgentDocExample } from "./types";

export interface CommandContext {
	args: string[]; // positionals
	values: Record<string, unknown>; // global/parsed flags
	rawArgs: string[]; // original argv slice
	bus: EventBus;
}

export interface Command {
	name: string;
	description: string;
	options?: Record<
		string,
		{ type: "string" | "boolean"; short?: string; multiple?: boolean }
	>;
	execute: (context: CommandContext) => Promise<void>;
	agentDoc?: string;
	examples?: AgentDocExample[];
}
