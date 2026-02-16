#!/usr/bin/env bun
/**
 * Auto-fix script for spy cleanup
 * Reads guardrail output and adds mockRestore() calls automatically
 */

import { readFile, writeFile } from "node:fs/promises";

interface Violation {
	file: string;
	line: number;
	spyVariable: string;
}

async function parseGuardrailOutput(outputFile: string): Promise<Violation[]> {
	const content = await readFile(outputFile, "utf-8");
	const violations: Violation[] = [];

	// Match lines like: 🔴 [spy-variable-without-restore] src/features/xxx.test.ts:24
	const violationRegex = /🔴.*?\]\s+([\w/.]+\.test\.ts):(\d+)/g;
	const codeRegex = /const\s+(\w+)\s*=\s*spyOn\(/;

	const lines = content.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const match = violationRegex.exec(lines[i]);
		if (match) {
			const file = match[1];
			const lineNum = Number.parseInt(match[2], 10);

			// Next line should have the code
			if (i + 1 < lines.length) {
				const codeLine = lines[i + 1];
				const codeMatch = codeRegex.exec(codeLine);
				if (codeMatch) {
					violations.push({
						file,
						line: lineNum,
						spyVariable: codeMatch[1],
					});
				}
			}
		}
	}

	return violations;
}

async function fixFile(
	filePath: string,
	violations: Violation[],
): Promise<void> {
	const content = await readFile(filePath, "utf-8");
	const lines = content.split("\n");

	// Group violations by test block
	const violationsByLine = violations.reduce(
		(acc, v) => {
			if (!acc[v.line]) acc[v.line] = [];
			acc[v.line].push(v.spyVariable);
			return acc;
		},
		{} as Record<number, string[]>,
	);

	// For each violation, find the end of the test and add mockRestore
	for (const [lineStr, spyVars] of Object.entries(violationsByLine)) {
		const line = Number.parseInt(lineStr, 10) - 1; // 0-indexed

		// Find the test block this spy belongs to
		let testStart = line;
		while (testStart > 0 && !lines[testStart].includes("test(")) {
			testStart--;
		}

		// Find the end of this test (closing brace with same indentation)
		const _testIndent = lines[testStart].match(/^(\s*)/)?.[1] || "";
		let testEnd = line;
		let braceCount = 0;
		let foundStart = false;

		for (let i = testStart; i < lines.length; i++) {
			const l = lines[i];
			if (l.includes("{")) {
				braceCount++;
				foundStart = true;
			}
			if (l.includes("}")) {
				braceCount--;
				if (foundStart && braceCount === 0) {
					testEnd = i;
					break;
				}
			}
		}

		// Find the last expect or meaningful line before the closing brace
		let insertLine = testEnd;
		for (let i = testEnd - 1; i > line; i--) {
			const l = lines[i].trim();
			if (
				l.startsWith("expect(") ||
				l.includes("process.exitCode") ||
				l.includes("await") ||
				(l.length > 0 && !l.startsWith("}") && !l.startsWith("//"))
			) {
				insertLine = i + 1;
				break;
			}
		}

		// Get the indentation from the previous line
		const indent = lines[insertLine - 1]?.match(/^(\s*)/)?.[1] || "\t\t";

		// Add mockRestore() calls for all spies in this test
		for (const spyVar of spyVars) {
			const restoreLine = `${indent}${spyVar}.mockRestore();`;
			// Check if it's not already there
			if (!lines[insertLine]?.includes(`${spyVar}.mockRestore()`)) {
				lines.splice(insertLine, 0, restoreLine);
				insertLine++; // Move insert point down for next spy
			}
		}
	}

	await writeFile(filePath, lines.join("\n"));
}

async function main() {
	const outputFile = process.argv[2] || "guardrail-spy-cleanup-results.txt";

	console.log(`📖 Parsing ${outputFile}...`);
	const violations = await parseGuardrailOutput(outputFile);

	console.log(`Found ${violations.length} violations`);

	// Group by file
	const byFile = violations.reduce(
		(acc, v) => {
			if (!acc[v.file]) acc[v.file] = [];
			acc[v.file].push(v);
			return acc;
		},
		{} as Record<string, Violation[]>,
	);

	console.log(`Affecting ${Object.keys(byFile).length} files\n`);

	// Fix each file
	for (const [file, fileViolations] of Object.entries(byFile)) {
		console.log(`🔧 Fixing ${file} (${fileViolations.length} violations)...`);
		try {
			await fixFile(file, fileViolations);
			console.log(`   ✅ Fixed`);
		} catch (err) {
			console.error(`   ❌ Error: ${err}`);
		}
	}

	console.log("\n✅ All files processed!");
	console.log(
		"\n💡 Run `bun test --coverage` to verify fixes, then commit if passing.",
	);
}

main().catch(console.error);
