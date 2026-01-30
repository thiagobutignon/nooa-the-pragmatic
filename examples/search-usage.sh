#!/usr/bin/env bash
# Search usage examples

# Basic search
nooa search "TODO"

# Search with regex
nooa search "\\bfunction\\s+\\w+" --regex

# JSON output for scripting
nooa search "error" --json | jq '.[] | .path'

# Search specific file types
nooa search "import" --include "*.ts" --exclude "*.test.ts"
