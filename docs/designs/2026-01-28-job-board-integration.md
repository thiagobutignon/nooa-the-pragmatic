# Design: Job Board Integration (Resume-Centric Search)

## Goal
Enable users to search for jobs directly from the CLI and automatically filter/match them against their resume skills.

## Architecture
We will leverage the existing **Nooa Bridge** and **JSON Resume Adapter** to create a seamless "Job Search -> Match" flow. We will use **SQLite** (via `bun:sqlite`) for local persistence of jobs.

### 1. New Subcommand: `jobs`
Syntax:
```bash
nooa jobs <resume-file> --search "Query" [--provider <name-or-url>]
nooa jobs --list [--status applied|saved]
nooa jobs --apply <job-id>
```

### 2. Database Schema (SQLite)
A local file `nooa.db` will store:
- `jobs`: `id`, `provider`, `title`, `company`, `url`, `match_score`, `status` (saved, applied, ignored), `raw_payload`.
- `applications`: Links to jobs with `date_applied`, `notes`.

### 2. Provider Presets
We will introduce "Presets" (pre-configured OpenAPI specs) for common job boards:
- `usa-jobs`: [USAJOBS API](https://developer.usajobs.gov/)
- `arbeitnow`: [Arbeitnow API](https://www.arbeitnow.com/api/job-board-api)
- `adzuna`: [Adzuna API](https://developer.adzuna.com/)

### 3. Data Flow
1. **Resume Parsing**: `nooa` parses the provided `<resume-file>` (PDF/MD) into a `JsonResume` object.
2. **Skill Extraction**: Extract keywords from the `skills` and `work` sections of the `JsonResume`.
3. **API Bridge**: Execute a search request via `src/bridge.ts` using the selected provider's spec.
4. **Matching Engine**: Compare the fetched job titles/descriptions with the extracted resume skills.
5. **Reporting**: Display a list of matching jobs with "Match Score" or "Relevant Skills".

## Implementation Plan

### `src/bridge.ts` (Expansion)
- Add a `Presets` registry that maps names (`usa-jobs`) to spec URLs.
- Allow `executeBridgeRequest` to handle array results from job searches.

### `src/jobs.ts` (New module)
- **`matchJob(resume: JsonResume, job: any): number`**: A simple keyword-overlap algorithm to rank jobs.
- **`formatJobDisplay(job: any): string`**: Transform various API responses into a consistent Markdown/Table output.

### `index.ts`
- Register the `jobs` subcommand.
- Handle CLI flags for searching, filtering, and provider selection.
