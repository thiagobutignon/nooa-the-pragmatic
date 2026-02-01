# Plan: NOOA MCP Integration (Model Context Protocol)

MCP (Model Context Protocol) is the standardized bridge between AI models and local data/tools. NOOA needs to be an MCP-capable host.

## Goal
Integrate MCP standard to allow NOOA to consume resources, prompts, and tools from anyone in the ecosystem.

## Proposed Strategy
1. **MCP Client Core**: Implement the JSON-RPC layer for communicating with MCP servers (stdio/websocket).
2. **Resource Discovery**: Expose MCP resources into NOOA's reflection and memory system.
3. **Tool Invocation**: Bridge MCP tools to NOOA's `Command` registry dynamically.

## Key Subcommands
- `nooa mcp connect <uri>`: Add a new MCP server.
- `nooa mcp list`: Show active MCP connections and available tools.
- `nooa mcp call <server> <tool> [args]`: Direct tool invocation for debugging.

## Convergence
The MCP integration will eventually merge with the Skills system, where a Skill can be a local implementation OR an MCP server reference.
