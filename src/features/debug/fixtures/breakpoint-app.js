import { writeFileSync } from "node:fs";

setTimeout(() => {
	const marker = "before";
	writeFileSync(process.env.DEBUG_OUT, `${marker}\n`, "utf8");
}, 50);
