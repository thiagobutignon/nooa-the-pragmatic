#!/usr/bin/env bun
import React from "react";
import { render } from "ink";
import { ReadFileDialog } from "./ReadFileDialog";

if (!process.stdin.isTTY || !process.stdout.isTTY) {
	console.error("Error: NOOA TUI requires a TTY. Run this in an interactive terminal.");
	process.exit(1);
}

render(<ReadFileDialog />);
