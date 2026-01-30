import type { Command, CommandContext } from "../../core/command";

const codeWriteHelp = `
Usage: nooa code write <path> [flags]

Arguments:
  <path>              Destination file path.

Flags:
  --from <path>       Read content from a file (otherwise stdin is used).
  --patch             Read a unified diff from stdin and apply to <path>.
  --patch-from <path> Read a unified diff from a file and apply to <path>.
  --overwrite         Overwrite destination if it exists.
  --json              Output result as JSON.
  --dry-run           Do not write the file.
  -h, --help          Show help.

Notes:
  Mutually exclusive: --patch/--patch-from cannot be combined with --from or non-patch stdin.
`;

const codeCommand: Command = {
    name: "code",
    description: "Code operations (write, patch)",
    execute: async ({ args, values }: CommandContext) => {
        const action = args[1];

        if (values.help) {
            console.log(codeWriteHelp);
            return;
        }

        if (action === "write") {
            const targetPath = args[2];
            if (!targetPath) {
                console.error("Error: Destination path is required.");
                process.exitCode = 2;
                return;
            }

            try {
                const { readFile, writeFile } = await import("node:fs/promises");
                const isPatchMode = Boolean(values.patch || values["patch-from"]);
                let content = "";
                let patched = false;

                if (isPatchMode && values.from) {
                    console.error("Error: --patch is mutually exclusive with --from.");
                    process.exitCode = 2;
                    return;
                }

                if (isPatchMode) {
                    let patchText = "";
                    if (values["patch-from"]) {
                        patchText = await readFile(String(values["patch-from"]), "utf-8");
                    } else if (!process.stdin.isTTY) {
                        patchText = await new Response(process.stdin).text();
                    }

                    if (!patchText) {
                        console.error(
                            "Error: Missing patch input. Use --patch-from or stdin.",
                        );
                        process.exitCode = 2;
                        return;
                    }

                    const { applyPatch } = await import("./patch.js");
                    const originalText = await readFile(targetPath, "utf-8");
                    content = applyPatch(originalText, patchText);
                    patched = true;
                    if (!values["dry-run"]) {
                        await writeFile(targetPath, content, "utf-8");
                    }
                } else {
                    if (!values.from && !process.stdin.isTTY) {
                        const stdinText = await new Response(process.stdin).text();
                        if (stdinText.length > 0) {
                            content = stdinText;
                        }
                    }

                    if (!content && values.from) {
                        content = await readFile(String(values.from), "utf-8");
                    }

                    if (!content) {
                        console.error("Error: Missing input. Use --from or stdin.");
                        process.exitCode = 2;
                        return;
                    }

                    const { writeCodeFile } = await import("./write.js");
                    const result = await writeCodeFile({
                        path: targetPath,
                        content,
                        overwrite: Boolean(values.overwrite),
                        dryRun: Boolean(values["dry-run"]),
                    });

                    if (values.json) {
                        console.log(
                            JSON.stringify(
                                {
                                    path: result.path,
                                    bytes: result.bytes,
                                    overwritten: result.overwritten,
                                    dryRun: Boolean(values["dry-run"]),
                                    mode: "write",
                                    patched: false,
                                },
                                null,
                                2,
                            ),
                        );
                    }

                    return;
                }

                if (values.json) {
                    console.log(
                        JSON.stringify(
                            {
                                path: targetPath,
                                bytes: Buffer.byteLength(content),
                                overwritten: true,
                                dryRun: Boolean(values["dry-run"]),
                                mode: "patch",
                                patched,
                            },
                            null,
                            2,
                        ),
                    );
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(`Error: ${message}`);
                process.exitCode = 1;
            }
            return;
        }

        // Fallback for unknown action
        console.log(codeWriteHelp);
    }
};

export default codeCommand;
