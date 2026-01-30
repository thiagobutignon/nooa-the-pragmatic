import type { Command } from "./command";

export class CommandRegistry {
    private commands = new Map<string, Command>();

    register(command: Command) {
        this.commands.set(command.name, command);
    }

    get(name: string): Command | undefined {
        return this.commands.get(name);
    }

    list(): Command[] {
        return Array.from(this.commands.values());
    }
}
