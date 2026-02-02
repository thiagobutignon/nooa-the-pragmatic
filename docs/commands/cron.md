# `nooa cron`

Gerencia trabalhos recorrentes de maneira autônoma.

```bash
Usage: nooa cron <subcommand> [args] [flags]

Manage recurring jobs for autonomous operations.

Subcommands:
  add <name> --every <schedule> -- <command...>
      Create a new recurring job. Accepts description, timeout, retry flags.

  list [--active] [--json]
      Lista trabalhos persistidos (.nooa/cron_jobs.db).

  remove <name> [--force]
      Remove permanentemente um job.

  enable <name>
      Reativa um job desativado.

  disable <name>
      Desativa um job mantendo a configuração.

  run <name> [--force]
      Executa imediatamente o job (fora do cron).

  status [name] [--json]
      Mostra último status, próximo run e health.

  logs <name> [--limit <n>] [--since <date>] [--json]
      Exibe histórico de execuções.

  edit <name> [--schedule <cron>] [--command <cmd>]
      Atualiza agendamento ou comando.

  pause <name>
      Pausa temporariamente o job.

  resume <name>
      Retoma um job pausado.

  history <name> [--limit <n>] [--json]
      Detalha estatísticas e tempos de execução.

Flags (para `add`):
  --every <schedule>      Cron schedule (obrigatório)
  --description <text>    Descrição humana
  --on-failure <action>   notify|retry|ignore (default notify)
  --retry <n>             Tentativas antes de falhar
  --timeout <duration>    Tempo máximo da execução
  --silent                Suprime logs normais
  --start-at <datetime>   Inicio retardado
  --end-at <datetime>     Expire após data
  --max-runs <n>          Limite de execuções
  --json                  Saída JSON

Global flags:
  --daemon                Start/stop the cron daemon
  --json                  Saída JSON
  -h, --help              Mostrar ajuda

## Armazenamento

Jobs são persistidos em `nooa.db` (SQLite) via `CronStore`, com tabela `cron_jobs`.

## Exemplos

```bash
# Agendar indexação diária
nooa cron add daily-index --every "6h" -- index repo

# Job com opções completas
nooa cron add memory-cleanup \
  --every "0 2 * * *" \
  --description "Clean old memory entries" \
  --timeout "10m" \
  --on-failure retry \
  --retry 2 \
  -- memory clear --older-than 30

# Listar jobs
nooa cron list --json

# Executar manualmente
nooa cron run daily-index

# Ver histórico e status
nooa cron status daily-index --json
nooa cron logs daily-index --limit 10
```

## Arquitetura

- `CronStore` usa `bun:sqlite` para persistir `cron_jobs` (nome único, schedule, comando, opções).
- Cada job guarda timestamps de criação/atualização, último run/status, próximo run estimado.
- Planejamento futuro: daemon que lê `cron_jobs` e executa `nooa cron run` conforme agendamento.

## Próximos passos

1. Implementar CLI para `list`, `remove`, `enable/disable`, `run`, `status`, `logs`, `edit`, `pause/resume`, `history`.
2. Registrar logs em `.nooa/cron/logs/<job>.log`.
3. Expor `--daemon` para controlar ciclo do cron.
