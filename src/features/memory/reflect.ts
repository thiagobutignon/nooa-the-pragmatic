import { MemoryEngine } from "./engine";
import { type TelemetryEvent } from "../../core/telemetry";

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

        // In a real scenario, this would call an LLM. 
        // For now, we capture the material fact.
        const content = `Session Reflection: Successfully executed ${event.event}. Resulting in material change to the codebase.`;
        
        await this.engine.addEntry({
            type: "decision",
            scope: "project",
            confidence: "medium",
            tags: ["auto-reflection", event.event.split(".")[0] || "unknown"],
            trace_id: event.trace_id,
            sources: [`telemetry:event:${event.event}`],
            content
        });
        this.reflectionCount++;
        return true;
    }
}
