export type BacklogAction =
	| "generate"
	| "validate"
	| "split"
	| "board"
	| "move"
	| "help";

export type BacklogMode = BacklogAction | "noop";

export interface BacklogStory {
	id: string;
	title: string;
	description: string;
	acceptanceCriteria: string[];
	priority: number;
	passes: boolean;
	state: string;
}

export interface BacklogPrd {
	project: string;
	branchName: string;
	description: string;
	userStories: BacklogStory[];
}
