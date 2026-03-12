import { writeFileSync } from "node:fs";

writeFileSync(process.env.DEBUG_OUT, "continued\n", "utf8");
