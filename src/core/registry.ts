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

async function importCommandModule(
	featuresDir: string,
	featureName: string,
): Promise<Command | undefined> {
	const cliPath = join(featuresDir, featureName, "cli.ts");
	try {
		await access(cliPath, constants.F_OK);
	} catch {
		return undefined;
	}

	try {
		const module = await import(cliPath);
		return module.default?.name ? (module.default as Command) : undefined;
	} catch (e) {
		if (e instanceof Error && "code" in e && e.code === "ENOENT") {
			return undefined;
		}
		console.error(`Error loading command from ${featureName}:`, e);
		return undefined;
	}
}

export async function loadCommandByName(
	featuresDir: string,
	name: string,
): Promise<Command | undefined> {
	return importCommandModule(featuresDir, name);
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
			const command = await importCommandModule(featuresDir, entry.name);
			if (command) {
				registry.register(command);
			}
		}
	}
	return registry;
}
