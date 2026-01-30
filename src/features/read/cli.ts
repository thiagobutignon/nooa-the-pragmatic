import type { Command, CommandContext } from "../../core/command";

const readCommand: Command = {
    name: "read",
    description: "Read file contents",
    execute: async ({ args, values }: CommandContext) => {
        let path = args[1];

        // Handle stdin if no path provided
        if (!path && !process.stdin.isTTY) {
            const stdinText = await new Response(process.stdin).text();
            path = stdinText.trim();
        }

        if (!path) {
            console.error("Error: Path is required.");
            process.exitCode = 2;
            return;
        }

        try {
            const { readFile } = await import("node:fs/promises");
            const content = await readFile(path, "utf-8");

            if (values.json) {
                console.log(
                    JSON.stringify(
                        {
                            path,
                            bytes: Buffer.byteLength(content),
                            content,
                        },
                        null,
                        2,
                    ),
                );
            } else {
                process.stdout.write(content);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.toLowerCase().includes("no such file")) {
                console.error(`Error: File not found: ${path}`);
            } else {
                console.error(`Error: ${message}`);
            }
            process.exitCode = 1;
        }
    }
};

export default readCommand;
