import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MemoryEngine } from "../../features/memory/engine";
import { parseMemoryFromMarkdown } from "../memory/schema";

export async function autoReflect(
	command: string,
	args: string[],
	result: unknown,
	forcedRoot?: string,
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

		// Skip help/version invocations to avoid slow reflection on CLI output-only paths
		if (
			args.some(
				(arg) =>
					arg === "--help" ||
					arg === "-h" ||
					arg === "--version" ||
					arg === "-v",
			)
		) {
			return;
		}

		// Determine outcome based on result (0 means success for shell-style commands)
		const isSuccess = typeof result === "number" ? result === 0 : !!result;
		const outcome = isSuccess ? "Success" : "Failure";

		const root = forcedRoot ?? process.cwd();
		const memoryEngine = new MemoryEngine(root);

		const content = `Ran command: ${command} ${args.join(" ")}\nOutcome: ${outcome}`;
		if (await hasMatchingAutoReflection(root, content)) {
			return;
		}

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

async function hasMatchingAutoReflection(root: string, content: string) {
	const today = new Date().toISOString().split("T")[0];
	const dailyPath = join(root, "memory", `${today}.md`);

	try {
		const markdown = await readFile(dailyPath, "utf-8");
		const blockRegex =
			/---\r?\n[\s\S]*?\r?\n---\r?\n?[\s\S]*?(?=\r?\n---\r?\n|$)/g;
		const blocks = markdown.match(blockRegex) || [];
		const normalizedTarget = normalizeContent(content);

		return blocks.some((block) => {
			try {
				const entry = parseMemoryFromMarkdown(block.trim());
				return (
					entry.tags?.includes("auto-reflection") &&
					normalizeContent(entry.content) === normalizedTarget
				);
			} catch {
				return false;
			}
		});
	} catch {
		return false;
	}
}

function normalizeContent(content: string) {
	return content.replace(/\s+/g, " ").trim();
}
