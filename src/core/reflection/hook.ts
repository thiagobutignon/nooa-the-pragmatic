import { MemoryEngine } from "../../features/memory/engine";

export async function autoReflect(
	command: string,
	args: string[],
	result: unknown,
	_forcedRoot?: string,
) {
	try {
		// Skip sensitive or trivial commands
		const ignoredCommands = ["init", "help", "version", "check", "memory"];
		if (ignoredCommands.includes(command)) return;

		// Skip if arguments contain sensitive flags (enhanced heuristic)
		const sensitivePatterns = ["token", "key", "secret", "password", "auth"];
		if (
			args.some((arg) =>
				sensitivePatterns.some((p) => arg.toLowerCase().includes(p)),
			)
		) {
			return;
		}

		// Determine outcome based on result (0 means success for shell-style commands)
		const isSuccess = typeof result === "number" ? result === 0 : !!result;
		const outcome = isSuccess ? "Success" : "Failure";

		const memoryEngine = new MemoryEngine();

		const content = `Ran command: ${command} ${args.join(" ")}\nOutcome: ${outcome}`;

		await memoryEngine.addEntry({
			type: "observation",
			scope: "session",
			confidence: "high",
			content,
			tags: ["auto-reflection", "cli", `outcome:${outcome.toLowerCase()}`],
			sources: [`cli:${command}`],
		});
	} catch {
		// Silent failure - reflection should never break the main flow
	}
}
