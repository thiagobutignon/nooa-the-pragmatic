import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatasetEntry } from "../features/eval/dataset";
import type { EvalCase, EvalSuite } from "../features/eval/engine";

async function main() {
	const datasetPath = join(process.cwd(), ".nooa/dataset.json");
	const outputPath = join(
		process.cwd(),
		"src/features/eval/suites/comprehensive.json",
	);

	console.log(`Reading dataset from ${datasetPath}...`);
	const content = await readFile(datasetPath, "utf-8");
	const dataset: DatasetEntry[] = JSON.parse(content);

	const cases: EvalCase[] = dataset.map((entry) => ({
		id: entry.id,
		vars: {}, // No specific vars needed for general smoke tests
		input_text: `User request: "${entry.input}"\n\nExecute the appropriate command.`,
		assertions: [
			{
				type: "contains",
				value: `${entry.output.split(" ")[0]} ${entry.output.split(" ")[1]}`, // Expect "nooa <cmd>"
			},
		],
	}));

	const suite: EvalSuite = {
		name: "comprehensive",
		prompt: "tui-agent", // Use the optimized prompt
		cases,
	};

	console.log(`Generating suite with ${cases.length} cases...`);
	await writeFile(outputPath, JSON.stringify(suite, null, 2));
	console.log(`Saved to ${outputPath}`);
}

main().catch(console.error);
