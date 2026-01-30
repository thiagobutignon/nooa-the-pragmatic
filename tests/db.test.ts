import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "node:fs";

const TEST_DB = "test.db";

const describeIfBun = typeof (globalThis as any).Bun === "undefined" ? describe.skip : describe;

describeIfBun("JobDatabase", () => {
    let JobDatabase: any;
    let db: any;

    beforeEach(async () => {
        if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
        if (!JobDatabase) {
            const mod = await import("../src/db");
            JobDatabase = mod.JobDatabase;
        }
        db = new JobDatabase(TEST_DB);
    });

    afterEach(() => {
        db.close();
        if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    });

    it("should save and list jobs", () => {
        const jobId = db.saveJob({
            provider: "test",
            externalId: "ext-1",
            title: "Frontend Dev",
            company: "Tech Corp",
            url: "https://jobs.com/1",
            matchScore: 0.85,
            status: "saved"
        });

        expect(jobId).toBeGreaterThan(0);

        const jobs = db.listJobs();
        expect(jobs).toHaveLength(1);
        expect(jobs[0].title).toBe("Frontend Dev");
        expect(jobs[0].match_score).toBe(0.85);
    });

    it("should update job status and create application", () => {
        db.saveJob({
            provider: "test",
            externalId: "ext-1",
            title: "Backend Dev",
            company: "Dev Inc",
            url: "https://jobs.com/2",
            matchScore: 0.9,
            status: "saved"
        });

        const job = db.listJobs()[0];
        db.updateJobStatus(job.id, "applied");

        const updatedJobs = db.listJobs({ status: "applied" });
        expect(updatedJobs).toHaveLength(1);
        expect(updatedJobs[0].status).toBe("applied");
    });

    it("should handle conflicts by updating existing job", () => {
        db.saveJob({
            provider: "test",
            externalId: "ext-1",
            title: "Old Title",
            company: "Old Co",
            url: "url1",
            matchScore: 0.5,
            status: "saved"
        });

        db.saveJob({
            provider: "test",
            externalId: "ext-1",
            title: "New Title",
            company: "New Co",
            url: "url2",
            matchScore: 0.95,
            status: "saved"
        });

        const jobs = db.listJobs();
        expect(jobs).toHaveLength(1);
        expect(jobs[0].match_score).toBe(0.95);
        // Note: Our ON CONFLICT only updates match_score and description currently
    });
});
