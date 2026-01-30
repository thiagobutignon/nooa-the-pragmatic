import { describe, expect, test } from "bun:test";
import { CommandRegistry } from "./registry";
import type { Command } from "./command";

describe("CommandRegistry", () => {
    test("registers and retrieves a command", () => {
        const registry = new CommandRegistry();
        const cmd: Command = {
            name: "test-cmd",
            description: "A test command",
            execute: async () => { },
        };

        registry.register(cmd);
        expect(registry.get("test-cmd")).toBe(cmd);
    });

    test("lists registered commands", () => {
        const registry = new CommandRegistry();
        registry.register({ name: "a", description: "desc a", execute: async () => { } });
        registry.register({ name: "b", description: "desc b", execute: async () => { } });

        const list = registry.list();
        expect(list).toHaveLength(2);
        // We can't guarantee order with a Map unless insertion order is relied upon, 
        // but Map preserves insertion order.
        expect(list.map(c => c.name)).toEqual(["a", "b"]);
    });
});
