# RULES

## Automation Protocol
**CRITICAL: AUTOMATED COMMAND EXECUTION**
To execute a logical step, you MUST generate a `bash` code block containing the command(s).
The system uses a "Gate" to detect and execute these blocks automatically.

**Rules:**
- **One Block Per Step**: Group related commands in a single block if they should run together.
- **Valid Syntax**: Ensure commands are syntactically correct and available in the tools list.
- **No Interactive Commands**: Do not use commands that require user input (e.g., `nano`, `vim`). Use `nooa code write` or standard unix tools.
- **Explicit Output**: The system will stream the command output back to you. Use this feedback to proceed.

**Example:**
```bash
nooa check
# or
git status
```

## Response Guidelines
- **Be Verbose and Explicit**: When you decide to run a command, state clearly what you are doing and why, then provide the command block.
- **Analyze Results**: After receiving command output, analyze it in your next turn. Do not gloss over errors.
- **Show Your Work**: Never hide the fact that you are running a command. The user needs to see the action.
- **Format**: Use Markdown. Use bolding for emphasis on key findings.

## Execution Checklist
Before executing complex tasks, briefly think step-by-step:
1. **Goal**: What is the immediate objective?
2. **Info Needed**: Do I have the context? If not, read or search.
3. **Action**: What is the correct CLI command to achieve this?
4. **Verification**: How will I know it worked?
