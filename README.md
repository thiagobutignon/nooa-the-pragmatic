# Nooa The Pragmatic

## Agent-First Development: The CLI-First Approach

This project demonstrates a shift from "Mobile First" to **"AI First"**.

In an AI-driven development era, the most efficient workflow is **CLI First**. Agents thrive on text-based interfaces, structured inputs/outputs, and rapid feedback loops. Building a CLI before a GUI reduces friction, enables easy testing, and creates a solid foundation that can later be wrapped in APIs, MCP Servers, or UI frontends.

### The Insight
- **Traditional Flow:** Database -> API -> SDK (Optional) -> Frontend -> Mobile (High friction, many layers)
- **Agent-First Flow:** CLI -> Logic/Core -> Test Verification -> Database -> API/MCP Server -> SDK (Optional) -> Frontend -> Mobile

By starting with a CLI:
1.  **Zero-Friction Testing:** Agents can execute the tool, parse the output, and verify correctness instantly.
2.  **Focus on Logic:** We solve the core problem without getting bogged down in UI state management or component libraries initially.
3.  **Composability:** The CLI becomes a primitive that can be orchestrated by other agents or scripts.

### Process
1.  **Define the Interface:** Treat the CLI help text (`--help`) as the requirements spec.
2.  **Test-Driven:** Write tests that invoke the CLI and assert the output.
3.  **Implement:** Build the core logic to satisfy the CLI contract.
4.  **Polish:** Refine heuristics and formatting (as seen in the PDF resume conversion).

*This project evolved from a simple PDF reading task to a full-featured Resume Conversion CLI (PDF <-> Markdown) in just a few efficient prompts, proving the efficacy of this workflow.*

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```