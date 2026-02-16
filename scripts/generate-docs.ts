import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentDocMeta } from "../src/core/types";

export type FeatureModule = {
	default?: { name?: string; description?: string; agentDoc?: string };
	[key: string]: unknown;
};

function findMeta(feature: FeatureModule): AgentDocMeta | undefined {
	for (const value of Object.values(feature)) {
		if (
			value &&
			typeof value === "object" &&
			"name" in value &&
			"description" in value &&
			"changelog" in value
		) {
			return value as AgentDocMeta;
		}
	}
	return undefined;
}

function findExportBySuffix<T>(
	feature: FeatureModule,
	suffix: string,
): T | undefined {
	for (const [key, value] of Object.entries(feature)) {
		if (key.endsWith(suffix)) {
			return value as T;
		}
	}
	return undefined;
}

export function generateFeatureDoc(
	feature: FeatureModule,
	includeChangelog: boolean,
) {
	const featureDoc = findExportBySuffix<(include: boolean) => string>(
		feature,
		"FeatureDoc",
	);
	if (featureDoc) return featureDoc(includeChangelog);

	const meta = findMeta(feature);
	const help = (findExportBySuffix<string>(feature, "Help") ?? "").trim();
	const agentDoc = (
		findExportBySuffix<string>(feature, "AgentDoc") ??
		feature.default?.agentDoc ??
		""
	).trim();
	const sdkUsage = (
		findExportBySuffix<string>(feature, "SdkUsage") ?? ""
	).trim();

	return `# ${meta?.name ?? "unknown"}\n\n${
		meta?.description ?? ""
	}\n\n## CLI Usage\n\n\`\`\`bash\n${help.trim()}\n\`\`\`\n\n## Agent Instructions\n\n\`\`\`xml\n${agentDoc.trim()}\n\`\`\`\n\n## SDK\n\n${sdkUsage.trim()}\n`;
}

export function generateManifest(features: FeatureModule[]) {
	return {
		generated: new Date().toISOString(),
		version: "1.0.0",
		features: features
			.map((feature) => {
				const meta = findMeta(feature);
				const agentDoc =
					findExportBySuffix<string>(feature, "AgentDoc") ??
					feature.default?.agentDoc ??
					"";
				if (!meta) return null;
				return {
					name: meta.name,
					version: meta.changelog[0]?.version ?? "1.0.0",
					description: meta.description,
					agentDoc,
				};
			})
			.filter(Boolean),
	};
}

async function main() {
	const root = process.cwd();
	const featuresDir = join(root, "src/features");
	const entries = await readdir(featuresDir, { withFileTypes: true });
	const features: FeatureModule[] = [];
	const includeChangelog = true;

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const featurePath = join(featuresDir, entry.name, "cli.ts");
		try {
			await access(featurePath);
			const feature = (await import(featurePath)) as FeatureModule;
			if (!findMeta(feature)) continue;
			features.push(feature);

			await mkdir(join(root, "docs/features"), { recursive: true });
			await writeFile(
				join(
					root,
					"docs/features",
					`${findMeta(feature)?.name ?? entry.name}.md`,
				),
				generateFeatureDoc(feature, includeChangelog),
			);
		} catch (error) {
			if (
				error instanceof Error &&
				"code" in error &&
				error.code === "ENOENT"
			) {
				continue;
			}
			console.error(`Failed to process ${entry.name}:`, error);
		}
	}

	await mkdir(join(root, ".nooa"), { recursive: true });
	await writeFile(
		join(root, ".nooa/AGENT_MANIFEST.json"),
		JSON.stringify(generateManifest(features), null, 2),
	);

	console.log(`Generated docs for ${features.length} feature(s).`);
}

if (import.meta.main) {
	await main();
}
