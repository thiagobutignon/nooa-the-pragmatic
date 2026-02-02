import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { IDENTITY_TEMPLATE, SOUL_TEMPLATE, USER_TEMPLATE } from "./templates";

export async function initIdentity(cwd: string = process.cwd()) {
	const nooaDir = join(cwd, ".nooa");
	await mkdir(nooaDir, { recursive: true });

	const files = [
		{
			name: "IDENTITY.md",
			content: IDENTITY_TEMPLATE.replace(
				"{{DATE}}",
				new Date().toISOString().split("T")[0],
			),
		},
		{ name: "SOUL.md", content: SOUL_TEMPLATE },
		{ name: "USER.md", content: USER_TEMPLATE },
	];

	for (const file of files) {
		const filePath = join(nooaDir, file.name);
		const fileHandle = Bun.file(filePath);

		if (!(await fileHandle.exists())) {
			await Bun.write(filePath, file.content);
		}
	}
}
