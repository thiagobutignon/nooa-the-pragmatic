export const PromptConfig = {
	maxContextTokens: 4000,
	maxTools: 10,
	maxSkills: 3,
	semantic: {
		minScore: 0.58,
		maxResults: 5,
		injectionMinScore: 0.75,
		enableModeSemantic: false,
	},
	paths: {
		constitution: ".nooa/prompts/layers/constitution.md",
		rules: ".nooa/prompts/layers/rules.md",
	},
	untrustedWrapper: (content: string) =>
		`<UNTRUSTED_CONTEXT>\n${content}\n</UNTRUSTED_CONTEXT>`,
};

export type PromptConfigType = typeof PromptConfig;
