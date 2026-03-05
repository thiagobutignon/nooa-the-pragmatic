import type { BacklogPrd } from "./types";

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

export function assertBacklogPrd(prd: BacklogPrd): void {
	if (!prd.project || !prd.branchName || !prd.description) {
		throw new Error("Generated PRD must include project, branchName and description");
	}
	if (!Array.isArray(prd.userStories) || prd.userStories.length === 0) {
		throw new Error("Generated PRD must include at least one user story");
	}
	const first = prd.userStories[0];
	if (!first?.id || !first.title || !first.description) {
		throw new Error("Generated PRD story is missing required fields");
	}
	if (!Array.isArray(first.acceptanceCriteria) || first.acceptanceCriteria.length === 0) {
		throw new Error("Generated PRD story must include acceptance criteria");
	}
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
	const branchName = branchSeed ? `feature/${branchSeed}` : "feature/backlog-item";
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
