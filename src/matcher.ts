import type { JsonResume } from "./json-resume";

export interface MatchResult {
    score: number;
    matchingSkills: string[];
    missingSkills: string[];
}

export function calculateMatchScore(resume: JsonResume, jobDescription: string): MatchResult {
    const resumeSkills = new Set<string>();

    // Extract skills from "skills" section
    if (resume.skills) {
        for (const skill of resume.skills) {
            if (skill.name) resumeSkills.add(skill.name.toLowerCase());
            if (skill.keywords) {
                for (const kw of skill.keywords) {
                    resumeSkills.add(kw.toLowerCase());
                }
            }
        }
    }

    // Extract potential skills from "work" experience (keywords)
    if (resume.work) {
        for (const work of resume.work) {
            if (work.keywords) {
                for (const kw of work.keywords) {
                    resumeSkills.add(kw.toLowerCase());
                }
            }
            if (work.highlights) {
                for (const h of work.highlights) {
                    // Very simple heuristic: pick words that look like technologies
                    const techWords = h.match(/\b(React|Node\.js|Typescript|Javascript|Python|Go|Docker|Kubernetes|AWS|SQL|NoSQL)\b/gi);
                    if (techWords) {
                        for (const w of techWords) resumeSkills.add(w.toLowerCase());
                    }
                }
            }
        }
    }

    const jobText = jobDescription.toLowerCase();

    const matchingSkills: string[] = [];
    const missingSkills: string[] = [];

    const skillArray = Array.from(resumeSkills);

    // We also need some "common" job requirements to check what's MISSING
    // For now, let's just check what we HAVE vs the job text
    for (const skill of skillArray) {
        if (jobText.includes(skill)) {
            matchingSkills.push(skill);
        }
    }

    // Heuristic: If we match 0 skills, score 0.
    // If we match 5+ skills, score 1.0.
    // Otherwise score is matchingSkills / 5.
    const score = Math.min(matchingSkills.length / 5, 1.0);

    return {
        score,
        matchingSkills,
        missingSkills: [] // To be implemented with Better Keyword Extraction
    };
}
