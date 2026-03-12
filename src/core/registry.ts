import { constants } from "node:fs";
import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
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
		return Array.from(this.commands.values()).sort((a, b) =>
			a.name.localeCompare(b.name),
		);
	}
}

export async function loadCommands(
	featuresDir: string,
): Promise<CommandRegistry> {
	const registry = new CommandRegistry();

	// Check if directory exists first
	try {
		await readdir(featuresDir);
	} catch {
		return registry;
	}

	const entries = await readdir(featuresDir, { withFileTypes: true });

	for (const entry of entries) {
		if (entry.isDirectory()) {
			const cliPath = join(featuresDir, entry.name, "cli.ts");
			try {
				await access(cliPath, constants.F_OK);
			} catch {
				continue;
			}

			try {
				const module = await import(cliPath);
				if (module.default?.name) {
					registry.register(module.default);
				}
			} catch (e) {
				if (e instanceof Error && "code" in e && e.code === "ENOENT") {
					continue;
				}
				console.error(`Error loading command from ${entry.name}:`, e);
			}
		}
	}
	return registry;
}
