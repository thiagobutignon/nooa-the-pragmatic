export function buildStandardOptions() {
	return {
		help: { type: "boolean", short: "h" },
		json: { type: "boolean" },
		"include-changelog": { type: "boolean" },
	} as const;
}
