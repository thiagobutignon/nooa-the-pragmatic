# `nooa cron`

Gerencia trabalhos recorrentes armazenando definições e logs no SQLite (`nooa.db` por padrão ou via `NOOA_DB_PATH`).

```bash
Usage: nooa cron <subcommand> [args] [flags]

Manage recurring jobs for autonomous operations.

Subcommands:
  add <name> --every <schedule> -- <command...>           Create a job with metadata.
  list [--active] [--json]                               List persisted jobs.
  remove <name> --force [--json]                         Delete a job (force avoids accidents).
  enable <name> [--json]                                 Re-enable or resume a paused job.
  disable <name> [--json]                                Disable a job without deleting it.
  run <name> [--force] [--json]                          Execute a job immediately.
  status <name> [--json]                                 Show last/next run, status, and enabled flag.
  logs <name> [--limit <n>] [--since <timestamp>] [--json]  View execution history.
  edit <name> [--schedule <cron>] [--command <cmd>] [--description <text>]  Update job metadata.
  pause <name> [--json]                                  Alias for disable.
  resume <name> [--json]                                 Alias for enable.
  history <name> [--limit <n>] [--since <timestamp>] [--json]  Alias for logs for analytics scripts.

Flags for `add`/`edit`:
  --every <schedule>      Cron schedule (e.g., "6h", "0 2 * * *").
  --description <text>    Human-friendly job description.
  --on-failure <action>   notify|retry|ignore (default: notify).
  --retry <n>             Retry attempts when `on_failure=retry`.
  --timeout <duration>    Runtime cap (e.g., "10m").
  --start-at <datetime>   Delay first execution until this timestamp.
  --end-at <datetime>     Stop running after the given date.
  --max-runs <n>          Stop after the specified number of successful runs.
  --command <text>        Replace the stored command (edit only).
  --schedule <cron>       Replace the schedule string (edit only).
  --limit <n>             Number of log entries to show (logs/history).
  --since <timestamp>     Only include log entries created after this RFC3339 timestamp.
  --force                 Required for destructive operations (`remove`, `run`).
  --json                  Output structured JSON for pipelines.
  --daemon <cmd>          Placeholder for future daemon commands (`start|stop|status`).
  -h, --help              Mostrar esta ajuda.
```

## Armazenamento

- O `CronStore` cria e mantém duas tabelas em SQLite (`nooa.db` por padrão ou `NOOA_DB_PATH`):
  - `cron_jobs`: armazena UUID, nome único, schedule, comando, descrição, retries, timeout, timestamps (`last_run_at`, `next_run_at`, `created_at`, `updated_at`), flags e contadores.
  - `cron_logs`: registra cada execução (`started_at`, `finished_at`, `duration_ms`, `output`, `error`) e referencia `cron_jobs` via `job_id`.
- O Singleton `cronService` é usado pela CLI (`nooa cron`) para manter toda lógica de leitura/escrita em um único lugar.
- `setupCronTable` (usado por `Store`) garante que ambas as tabelas existam antes de qualquer operação.

## Exemplos

```bash
# Agendar indexação a cada 6 horas
nooa cron add daily-index --every "6h" -- index repo

# Job completo com descrição, timeout e retries
nooa cron add memory-cleanup \
  --every "0 2 * * *" \
  --description "Limpa memórias antigas" \
  --timeout "10m" \
  --on-failure retry \
  --retry 2 \
  -- memory clear --older-than 30

# Listar apenas jobs ativos
nooa cron list --active

# Executar manualmente e conferir logs
nooa cron run daily-index --force
nooa cron logs daily-index --limit 5 --json

# Atualizar schedule e descrição
nooa cron edit daily-index --schedule "0 4 * * *" --description "Rodar de madrugada"

# Remover job
nooa cron remove daily-index --force
```

## Arquitetura resumida

- `cronService` constrói `CronStore` com `bun:sqlite` e serve o CLI.
- `CronStore.recordExecution` registra cada execução em `cron_logs` e atualiza timestamps em `cron_jobs`.
- `nooa cron` usa `cronService` para todas as operações, garantindo consistência e fácil coleta de JSON para automações.
- Os testes em `src/features/cron/cli.test.ts` validam help, add/list/status/run/logs/edit/remove flows.

## Próximos passos

1. Implementar daemon real (`nooa cron --daemon start|stop|status`).
2. Adicionar locks na execução e evitar runs paralelos em ambientes de produção.
3. Expandir `history` para retornar métricas como taxa de sucesso e tempo médio.
