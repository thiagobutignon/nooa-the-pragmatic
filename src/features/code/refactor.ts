import { readFile, writeFile } from "node:fs/promises";
import { AiEngine } from "../ai/engine";

// Create a single instance or reuse? 
// In executed commands usually nice to have a singleton or fresh one.
// We'll create one here for simplicity as per test expectation of it being used.
const ai = new AiEngine();

export async function executeRefactor(path: string, instructions: string): Promise<string> {
    const content = await readFile(path, "utf-8");
    // Simple prompt construction
    const prompt = `Refactor the following code based on these instructions:\n${instructions}\n\nCode:\n\`\`\`\n${content}\n\`\`\`\n\nReturn ONLY the refactored code without markdown fences.`;

    const result = await ai.complete({
        messages: [{ role: "user", content: prompt }],
    });
    const newCode = result.content.replace(/^```.*\n/, "").replace(/\n```$/, ""); // Strip potential markdown

    await writeFile(path, newCode);
    return `Refactored ${path}`;
}
