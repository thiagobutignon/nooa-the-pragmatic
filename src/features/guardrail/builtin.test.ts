import { expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	getBuiltinProfilesDir,
	listBuiltinProfiles,
	loadBuiltinProfile,
} from "./builtin";

test("getBuiltinProfilesDir returns correct path", () => {
	// It uses process.cwd(), so it depends on execution context.
	const expected = join(process.cwd(), ".nooa", "guardrails", "profiles");
	expect(getBuiltinProfilesDir()).toBe(expected);
});

test("listBuiltinProfiles returns known profiles", () => {
	const profiles = listBuiltinProfiles();
	expect(profiles).toContain("default");
	expect(profiles).toContain("security");
	expect(profiles).toContain("semantic-sanitization");
	expect(profiles.length).toBeGreaterThanOrEqual(4);
});

test("loadBuiltinProfile loads a profile", async () => {
	// We need to ensure the file exists.
	// Since getBuiltinProfilesDir points to .nooa in CWD, we might need to mock it or create files.

	// Let's create a temp dir and changing cwd is tricky for parallel tests,
	// but we can rely on integration if we are careful.
	// However, unit test is better.

	// If we can't mock getBuiltinProfilesDir easily (it's exported func),
	// we can create the file in the expected location.

	const dir = getBuiltinProfilesDir();
	await mkdir(dir, { recursive: true });

	const profilePath = join(dir, "default.yaml");
	await writeFile(
		profilePath,
		`
refactor_name: default
version: '1.0'
description: Test profile
rules: []
`,
	);

	try {
		const profile = await loadBuiltinProfile("default");
		expect(profile.refactor_name).toBe("default");
	} finally {
		await rm(profilePath);
	}
});
