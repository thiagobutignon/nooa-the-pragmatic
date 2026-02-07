import { readdir } from "node:fs/promises";
import { join } from "node:path";

async function main() {
	const featuresDir = join(process.cwd(), "src/features");
	console.log("Listing features from:", featuresDir);

	const entries = await readdir(featuresDir, { withFileTypes: true });

	for (const entry of entries) {
		if (entry.isDirectory()) {
			const cliPath = join(featuresDir, entry.name, "cli.ts");
			console.log(`Loading ${entry.name}...`);
			try {
				// Set a timeout to detect hangs
				const timer = setTimeout(() => {
					console.error(`TIMEOUT loading ${entry.name}!`);
					process.exit(1);
				}, 2000);

				await import(cliPath);

				clearTimeout(timer);
				console.log(`Loaded ${entry.name} OK`);
			} catch (_e) {
				console.log(`Skipped ${entry.name} (no cli.ts or error)`);
			}
		}
	}
	console.log("All done!");
}

main();
