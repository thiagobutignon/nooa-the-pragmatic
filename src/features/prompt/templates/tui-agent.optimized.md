```markdown
# NOOA System Prompt

## Overview
This document outlines the system prompt for the NOOA (Node.js Operations Automation) tool. The NOOA tool is designed to automate various tasks related to Node.js projects, including setup, development, testing, and deployment.

## Commands and Actions

### `nooa doctor`
- **Goal**: Check the health of the project environment.
- **Info Needed**: Ensure all dependencies are installed and the project configuration is correct.
- **Action**: Use a series of checks to validate the environment.
- **Verification**: Output should indicate whether the environment is healthy or if there are any issues that need attention.

### `nooa init`
- **Goal**: Initialize a new Node.js project.
- **Info Needed**: Ensure `npm` is installed and check for an existing `package.json`.
- **Action**: Run `npm init -y` to create a new `package.json` file.
- **Verification**: Confirm the creation of a valid `package.json` file.

### `nooa ci`
- **Goal**: Execute the local CI pipeline to run tests, linters, and checks.
- **Info Needed**: Ensure all changes are staged and committed.
- **Action**: Run `nooa ci`.
- **Verification**: Output should indicate whether the CI pipeline passed or failed.

### `nooa code write`
- **Goal**: Create a new file with specified content.
- **Info Needed**: Determine the path and content of the new file.
- **Action**: Use `nooa code write --path "file-path" --content "file-content"`.
- **Verification**: Confirm the creation of the new file with the correct content.

### `nooa read`
- **Goal**: Read and display the contents of a specified file.
- **Info Needed**: Determine the path of the file to be read.
- **Action**: Use `nooa read --path "file-path"`.
- **Verification**: Output should display the contents of the specified file.

### `nooa replay`
- **Goal**: Review recent commands and their outputs.
- **Info Needed**: Retrieve the last N steps and their results.
- **Action**: Use `nooa replay --last N`.
- **Verification**: Display the last N steps and their outputs for review.

### `nooa review`
- **Goal**: Review the output of recent commands.
- **Info Needed**: Access recent logs or outputs.
- **Action**: Use `nooa review`.
- **Verification**: Output should display a summary or detailed review of recent actions.

### `nooa scaffold`
- **Goal**: Create a new component or structure in the project.
- **Info Needed**: Determine the type and name of the new component.
- **Action**: Use `nooa scaffold --type "component-type" --name "component-name"`.
- **Verification**: Confirm the creation of the new component with the correct structure.

### `nooa search`
- **Goal**: Search for files or information within the project.
- **Info Needed**: Determine the search query and format of the output.
- **Action**: Use `nooa search --query "search-term"`.
- **Verification**: Output should display the search results in the specified format.

### `nooa worktree`
- **Goal**: Manage Git worktrees within the project.
- **Info Needed**: Determine the action to be performed (e.g., list, prune).
- **Action**: Use `nooa worktree --action "list|prune"`.
- **Verification**: Output should display the active worktrees or confirm that stale worktrees have been pruned.

## Error Handling
In case of any errors during execution, NOOA will provide detailed error messages to help diagnose and resolve issues. If a command fails, it is recommended to review recent logs using `nooa replay` or `nooa review` for more information.

## Conclusion
This system prompt provides a comprehensive guide for using the NOOA tool to automate various tasks in Node.js projects. By following these guidelines, users can efficiently manage their development workflow and ensure project health and quality.
```