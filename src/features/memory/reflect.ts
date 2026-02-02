import { MemoryEngine } from "./engine";
import { type TelemetryEvent } from "../../core/telemetry";
import { join } from "node:path";
import { summarizeMemory } from "./summarize";

export class Reflector {
    private engine: MemoryEngine;
    private reflectionCount = 0;
    private readonly MAX_REFLECTIONS = 3;
    
    private materialEvents = new Set([
        "code.write.success",
        "code.patch.success",
        "commit.success",
        "scaffold.success",
        "eval.apply.success",
        "worktree.success",
        "init.success"
    ]);

    constructor(engine?: MemoryEngine) {
        this.engine = engine || new MemoryEngine();
    }

    isMaterial(event: string): boolean {
        return this.materialEvents.has(event);
    }

    async reflect(event: TelemetryEvent): Promise<boolean> {
        if (this.reflectionCount >= this.MAX_REFLECTIONS) return false;
        if (!this.isMaterial(event.event) || !event.success) return false;

        let content = `Session Reflection: Successfully executed ${event.event}. Resulting in material change to the codebase.`;
        
        try {
            const { AiEngine } = await import("../ai/engine");
            const { PromptEngine } = await import("../prompt/engine");
            const { MockProvider, OllamaProvider, OpenAiProvider } = await import("../ai/providers/mod");
            
            const templatesDir = join(process.cwd(), "src/features/prompt/templates");
            const promptEngine = new PromptEngine(templatesDir);
            const aiEngine = new AiEngine();
            aiEngine.register(new OllamaProvider());
            aiEngine.register(new OpenAiProvider());
            aiEngine.register(new MockProvider());

            const prompt = await promptEngine.loadPrompt("reflection");
            const rendered = await promptEngine.renderPrompt(prompt, {
                event: event.event,
                metadata: JSON.stringify(event.metadata || {}),
                repo_root: process.cwd(),
                vibe: "resourceful",
                posture: "Surgical, high-speed, direct"
            }, { skipAgentContext: true });

            const provider = process.env.NOOA_AI_PROVIDER || "ollama";
            const response = await aiEngine.complete({
                messages: [{ role: "system", content: rendered }],
                traceId: `reflect-${event.trace_id || "gen"}`
            }, { provider });

            if (provider !== "mock" && response.content) {
                content = response.content.trim();
            }
        } catch {
            // Fallback to default content
        }
        
        await this.engine.addEntry({
            type: "decision",
            scope: "project",
            confidence: "medium",
            tags: ["auto-reflection", event.event.split(".")[0] || "unknown"],
            trace_id: event.trace_id,
            sources: [`telemetry:event:${event.event}`],
            content
        });
        
        await summarizeMemory(process.cwd());
        
        this.reflectionCount++;
        return true;
    }
}
