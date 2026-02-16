import { describe, expect, test } from "bun:test";
import {
	generateFeatureDoc,
	generateManifest,
} from "../../scripts/generate-docs";

describe("docs generator", () => {
	const mockFeature = {
		readMeta: {
			name: "read",
			description: "Read file contents",
			changelog: [
				{ version: "1.2.0", changes: ["Added stdin support"] },
				{ version: "1.1.0", changes: ["Added --json flag"] },
			],
		},
		readHelp: "Usage: nooa read <path>",
		readAgentDoc: '<instruction version="1.2.0" name="read">...</instruction>',
		readSdkUsage: "const result = await read.run({ path: 'file.txt' });",
	};

	test("generateFeatureDoc creates markdown", () => {
		const md = generateFeatureDoc(mockFeature, true);
		expect(md).toContain("# read");
		expect(md).toContain("Usage: nooa read");
		expect(md).toContain("Agent Instructions");
		expect(md).toContain("SDK");
	});

	test("generateManifest creates manifest JSON", () => {
		const manifest = generateManifest([mockFeature]);
		expect(manifest.features).toHaveLength(1);
		expect(manifest.features[0]?.name).toBe("read");
	});
});
