# NOOA MEMORY SUMMARY
> Context curated for high-integrity results. Precedence: Constitution.

### Recent Observations
- [2026-02-02] Ran command: review review --help
Outcome: Failure
- [2026-02-02] Ran command: prompt prompt
Outcome: Failure
- [2026-02-02] Ran command: prompt prompt --json
Outcome: Failure
- [2026-02-02] Ran command: prompt prompt --help
Outcome: Failure
- [2026-02-02] Ran command: prompt prompt --help
Outcome: Failure
- [2026-02-02] Ran command: cron cron status cleanup
Outcome: Success
- [2026-02-02] Ran command: cron cron remove cleanup --force
Outcome: Success
- [2026-02-02] Ran command: cron cron remove cleanup
Outcome: Success
- [2026-02-02] Ran command: cron cron edit cleanup --schedule 0 4 * * * --description updated
Outcome: Success
- [2026-02-02] Ran command: cron cron add cleanup --every 0 3 * * * -- echo cleanup
Outcome: Success
- [2026-02-02] Ran command: cron cron history runner --json
Outcome: Success
- [2026-02-02] Ran command: cron cron logs runner --json
Outcome: Success
- [2026-02-02] Ran command: cron cron status runner --json
Outcome: Success
- [2026-02-02] Ran command: cron cron run runner --force
Outcome: Success
- [2026-02-02] Ran command: cron cron add runner --every @daily -- echo ok
Outcome: Success
- [2026-02-02] Ran command: cron cron list --json
Outcome: Success
- [2026-02-02] Ran command: cron cron add status-job --every 1h -- true
Outcome: Success
- [2026-02-02] Ran command: cron cron list
Outcome: Success
- [2026-02-02] Ran command: cron cron add daily-index --every 6h -- echo index
Outcome: Success
- [2026-02-02] Ran command: cron cron --help
Outcome: Success