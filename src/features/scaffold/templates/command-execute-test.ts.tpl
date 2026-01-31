import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { execute{{Command}} } from "./execute";

describe("execute{{Command}}", () => {
    let originalProvider: string | undefined;

    beforeEach(() => {
        originalProvider = process.env.NOOA_AI_PROVIDER;
        process.env.NOOA_AI_PROVIDER = "mock";
    });

    afterEach(() => {
        if (originalProvider) {
            process.env.NOOA_AI_PROVIDER = originalProvider;
        } else {
            delete process.env.NOOA_AI_PROVIDER;
        }
    });

    it("should track telemetry and return ok", async () => {
        const { result, traceId } = await execute{{Command}}({
            json: true
        });

        expect(traceId).toBeDefined();
        expect(result.message).toBe("Action performed by {{name}}");
    });
});
