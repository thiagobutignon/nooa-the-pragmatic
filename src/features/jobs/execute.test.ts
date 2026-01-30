import { describe, test, expect, beforeEach, spyOn } from "bun:test";
import jobsCommand from "./cli";
import { EventBus } from "../../core/event-bus";
import * as jobs from "./jobs.js";

describe("jobs command", () => {
    let bus: EventBus;

    beforeEach(() => {
        bus = new EventBus();
        // Mock the jobs module via spies
        spyOn(jobs, "searchAndMatchJobs").mockImplementation(async () => [] as any);
        spyOn(jobs, "listJobs").mockImplementation(() => [
            { id: 1, title: "Software Engineer", company: "AntiGravity", match_score: 0.95, status: "new", url: "http://example.com" }
        ] as any);
        spyOn(jobs, "applyToJob").mockImplementation(() => { });
    });

    test("help: displays help", async () => {
        let output = "";
        spyOn(console, "log").mockImplementation((msg: string) => {
            output = msg;
        });

        await jobsCommand.execute({ args: ["jobs"], values: { help: true } as any, bus });
        expect(output).toContain("Usage: nooa jobs");
    });

    test("success: list jobs", async () => {
        let output = "";
        spyOn(console, "log").mockImplementation((msg: string) => {
            output += msg + "\n";
        });

        await jobsCommand.execute({ args: ["jobs"], values: { list: true } as any, bus });
        expect(output).toContain("Saved Jobs (ranked by match score)");
        expect(output).toContain("Software Engineer @ AntiGravity");
    });

    test("success: apply to job", async () => {
        let eventEmitted = false;
        bus.on("jobs.applied", () => {
            eventEmitted = true;
        });

        await jobsCommand.execute({ args: ["jobs"], values: { apply: "1" } as any, bus });
        expect(eventEmitted).toBe(true);
    });

    test("failure: missing search query", async () => {
        let errorLogged = false;
        spyOn(console, "error").mockImplementation((msg: string) => {
            if (msg.includes("required")) errorLogged = true;
        });

        await jobsCommand.execute({ args: ["jobs", "resume.md"], values: {} as any, bus });
        expect(errorLogged).toBe(true);
        expect(process.exitCode).toBe(1);
        process.exitCode = undefined;
    });

    test("success: search and match", async () => {
        let output = "";
        spyOn(console, "log").mockImplementation((msg: string) => {
            output += msg + "\n";
        });

        await jobsCommand.execute({ args: ["jobs", "resume.md"], values: { search: "engineer" } as any, bus });
        expect(output).toContain("Done!");
    });

    test("error handling: exception during execution", async () => {
        spyOn(jobs, "listJobs").mockImplementation(() => { throw new Error("DB Error"); });

        let errorLogged = false;
        spyOn(console, "error").mockImplementation((msg: string) => {
            if (msg.includes("Jobs error:")) errorLogged = true;
        });

        await jobsCommand.execute({ args: ["jobs"], values: { list: true } as any, bus });
        expect(errorLogged).toBe(true);
        expect(process.exitCode).toBe(1);
        process.exitCode = undefined;
    });
});
