import { MemoryEngine } from "../../features/memory/engine";

export interface ReflectionOptions {
	root?: string; // For testing injection
}

export async function autoReflect(
	command: string,
	args: string[],
	_result: unknown,
	_forcedRoot?: string,
) {
	try {
		// Skip sensitive or trivial commands
		const ignoredCommands = ["init", "help", "version", "check"];
		if (ignoredCommands.includes(command)) return;

		// Skip if arguments contain sensitive flags (basic heuristic)
		if (args.includes("--token") || args.includes("-t")) return;

		const memoryEngine = new MemoryEngine();
		// In a real scenario, we might want to inject the root into MemoryEngine if it supported it via constructor.
		// For now, MemoryEngine uses process.cwd() or similar.
		// If we need to support forcedRoot for tests, we'd need to modify MemoryEngine or run tests in real temp dirs (which we are doing).
		// However, the test injects a Mock MemoryEngine, so the root path in the constructor matters less there.
		// BUT, for the real implementation, we just use the default.

		const content = `Ran command: ${command} ${args.join(" ")}\nOutcome: Success`;

		await memoryEngine.addEntry({
			type: "observation",
			scope: "session",
			confidence: "high",
			content,
			tags: ["auto-reflection", "cli"],
			sources: [`cli:${command}`],
		});
	} catch (_e) {
		// Silent failure - reflection should never break the main flow
		// But we might log it to debug
		// logger.debug("Auto-reflection failed", e);
	}
}
