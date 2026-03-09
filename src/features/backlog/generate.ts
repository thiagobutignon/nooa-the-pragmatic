import type { BacklogPrd } from "./types";
import { assertBacklogPrd } from "./validate";

export interface GenerateBacklogInput {
	prompt: string;
	project?: string;
	branchName?: string;
}

function slugify(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

function toTitle(prompt: string) {
	const base = prompt.trim().replace(/\s+/g, " ");
	if (base.length <= 72) return base;
	return `${base.slice(0, 69)}...`;
}

export async function generateBacklogFromPrompt(
	input: GenerateBacklogInput,
): Promise<BacklogPrd> {
	const prompt = input.prompt.trim();
	if (!prompt) {
		throw new Error("Prompt is required for backlog generation");
	}

	const project = input.project ?? "Ralph Loop Backlog";
	const branchSeed = input.branchName ?? slugify(prompt);
	const branchName = branchSeed
		? `feature/${branchSeed}`
		: "feature/backlog-item";
	const title = toTitle(prompt);

	const prd: BacklogPrd = {
		project,
		branchName,
		description: prompt,
		userStories: [
			{
				id: "US-001",
				title,
				description: `Implementar: ${prompt}`,
				acceptanceCriteria: [
					"A implementação deve ser funcional e verificável por CLI.",
					"A solução deve incluir documentação mínima de uso.",
					"A story deve manter compatibilidade com o fluxo Ralph.",
					"O estado inicial da story deve ser pending com passes=false.",
				],
				priority: 1,
				passes: false,
				state: "pending",
			},
		],
	};

	assertBacklogPrd(prd);
	return prd;
}
