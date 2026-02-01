import { readFile } from "node:fs/promises";

export interface PolicyViolation {
    rule: string;
    file: string;
    line: number;
    content: string;
    message: string;
}

export interface PolicyResult {
    ok: boolean;
    violations: PolicyViolation[];
}

export class PolicyEngine {
    private forbiddenMarkers = [
        { pattern: /TODO[:\s]/i, rule: "no-todo", message: "Zero-Preguiça: TODOs are not allowed in production code." },
        { pattern: /MOCK[:\s]/i, rule: "no-mock", message: "Zero-Preguiça: MOCKs are not allowed in production code." },
        { pattern: /FIXME[:\s]/i, rule: "no-fixme", message: "Zero-Preguiça: FIXMEs are not allowed in production code." }
    ];

    async checkFile(path: string): Promise<PolicyViolation[]> {
        if (path.endsWith(".md") || path.endsWith(".tpl")) return [];
        const isTestFile = path.endsWith(".test.ts") || path.endsWith(".spec.ts");
        
        const violations: PolicyViolation[] = [];
        try {
            const content = await readFile(path, "utf-8");
            const lines = content.split("\n");

            for (let i = 0; i < lines.length; i++) {
                const lineContent = lines[i];
                if (lineContent === undefined) continue;
                for (const marker of this.forbiddenMarkers) {
                    if (isTestFile && marker.rule === "no-mock") continue;
                    if (marker.pattern.test(lineContent)) {
                        violations.push({
                            rule: marker.rule,
                            file: path,
                            line: i + 1,
                            content: lineContent.trim(),
                            message: marker.message
                        });
                    }
                }
            }
        } catch {
            // Skip binary or unreadable files
        }
        return violations;
    }

    async checkFiles(paths: string[]): Promise<PolicyResult> {
        const allViolations: PolicyViolation[] = [];
        for (const path of paths) {
            const violations = await this.checkFile(path);
            allViolations.push(...violations);
        }

        return {
            ok: allViolations.length === 0,
            violations: allViolations
        };
    }
}
