import { createTraceId } from "../../core/logger";
import { telemetry } from "../../core/telemetry";

export interface {{Command}}Options {
    json?: boolean;
    // Add custom options
}

export async function execute{{Command}}(options: {{Command}}Options, bus?: any) {
    const traceId = createTraceId();
    const startTime = Date.now();

    // 1. Core Logic
    // TODO: Implement {{name}} logic
    const result = {
        message: "Action performed by {{name}}"
    };

    // 2. Telemetry
    telemetry.track({
        event: "{{name}}.success",
        level: "info",
        success: true,
        duration_ms: Date.now() - startTime,
        trace_id: traceId,
        metadata: {
            json: !!options.json
        }
    }, bus);

    return { result, traceId };
}
