Boa. Esse plano tá bem alinhado com “copy-first / determinístico / TDD”. Vou responder **direto nos dois pontos de decisão** e depois te dou **ajustes cirúrgicos** (para evitar dívida técnica e evitar bugs de CLI como o que você já viu no `check --help`).

---

## 1) Decisão do comando: `guardrail` vs `check --profile` vs ambos

**Recomendação: BOTH, mas com `check --profile` como fonte de verdade.**

### Por quê

* **`nooa check` já é o guardrail central** (Zero-Preguiça). Profiles YAML são uma extensão natural.
* Ter um **comando “marketável”** (`nooa guardrail`) é ótimo para UX e posicionamento, mas não pode duplicar lógica.

### Implementação correta

* `nooa check --profile <path>` = **core**
* `nooa guardrail ...` = **alias / façade** que chama o check internamente

Exemplos:

* `nooa guardrail check --profile x.yaml` → internamente faz `nooa check --profile x.yaml`
* `nooa guardrail validate --profile x.yaml` → valida schema do YAML (sem rodar)
* `nooa guardrail init` → gera template YAML (copy-first)

**Aceite:** um único engine, um único schema de report, uma única tabela de exit codes.

---

## 2) Decisão de escopo: OpenSpec-like workflow e SQLite indexing

**Recomendação: P3 opcional, mas com uma “trilha mínima” que não trava o roadmap.**

### OpenSpec Workflow

✅ **Sim, mas só como “convenção de pasta + comando leve”**, não como framework.

* Cria um diretório padrão tipo `.nooa/guardrails/` ou `.nooa/specs/guardrails/`
* `nooa guardrail init` pode criar:

  * `.nooa/guardrails/profiles/<name>.yaml`
  * `.nooa/guardrails/examples/`
  * `.nooa/guardrails/README.md`

**Não inventa pipeline complexa** agora. Só estrutura e fluxo.

### SQLite-based indexing

⚠️ **Só se você medir gargalo real.**
Hoje você já tem:

* `search` com rg
* `index` semântico (embeddings)
* DB core já existe (você tem schema de cron e embeddings)

Então: **P3 é ok**, mas não é “necessário” para o guardrail determinístico inicial.

**Aposta certa:** faça o engine do guardrail funcionar primeiro com:

* `git ls-files` (escopo)
* `rg` / leitura direta (patterns)
* `.nooa-ignore` / includes/excludes com micromatch

Depois, se travar performance, aí sim index.

---

## Ajustes obrigatórios no seu plano (pra não criar bugs e duplicação)

### A) Não injeta `loadProfile()` dentro do `PolicyEngine`

Seu diff sugere:

```diff
+ import { loadProfile } from "../../features/guardrail/profiles";
+ private externalProfile?: RefactorProfile;
+ loadProfile(path) ...
```

Isso cria **acoplamento core → feature** e vai virar bola de neve.

✅ Melhor:

* `PolicyEngine` continua responsável por **regras internas** (ex.: forbidden markers).
* Crie `GuardrailEngine` no feature e o `check` (CLI) coordena:

Fluxo:

* `check` roda PolicyEngine (interno)
* se `--profile`, roda GuardrailEngine (externo YAML)
* junta findings num report unificado

**Resultado:** mantém Clean Architecture + vertical slice.

---

### B) Exit codes: do jeito que você escreveu vai causar confusão

Você colocou:

* 0 ok
* 1 warnings
* 2 errors

Só que `check` já usa (0/2) e `push` tem (3) para test fail.
Não espalha isso sem padronizar.

✅ Sugestão consistente de exit codes para auditoria/guardrail:

* **0** = ok
* **1** = runtime error (erro de execução)
* **2** = validation error (YAML inválido / flags inválidas / path inválido)
* **3** = findings high/critical (bloqueia)
* **4** = findings medium/low (não bloqueia, mas sinaliza)

Ou se quiser manter curto:

* 0 ok
* 1 runtime error
* 2 invalid inputs
* 3 findings (qualquer severidade)
  Mas aí você perde “warnings vs errors”.

**Minha recomendação:** 0/1/2/3/4 — fica determinístico e não conflita com `commit/push`.

---

### C) YAML loader: não use `readFileSync` (no Bun/Node CLI)

Use `readFile` async para manter padrão do repo (e não travar).

E **valide com schema**:

* Zod ou validator próprio (já que vocês curtem determinismo)
* Pelo menos: required fields, enums, shape de `match`, `scope`

Sem schema, profile vira bomba relógio.

---

### D) “PatternSpec” precisa definir semântica com clareza

Hoje você tem:

```ts
identifiers?: string[];
expressions?: string[];
sql_tables?: string[];
api_routes?: string[];
```

Mas o engine precisa saber:

* `identifiers`: match literal? word boundary?
* `expressions`: regex? multi-line?
* como lidar com `expect` (inverso do match? “deve existir”?)

✅ Recomendo padronizar o PatternSpec em algo como:

```ts
type Pattern = { type: "literal" | "regex"; value: string; flags?: string };

match: { anyOf?: Pattern[]; allOf?: Pattern[] }
expect?: { anyOf?: Pattern[]; allOf?: Pattern[] } // “must exist”
```

Isso evita ambiguidade e dá determinismo.

---

### E) “Copy without generating”: cuidado com paths inventados

Seu plano lista arquivos tipo `theauditor/refactor/yaml_rules/profile.yaml`, etc.

Como o repo Auditor está arquivado, esses caminhos podem **não bater** com a estrutura real do projeto.
Antes de cravar, o processo correto é:

1. `find . -name "*.yaml" -o -name "*.yml" -o -name "*.json"`
2. gerar inventário
3. só então definir copy list

✅ No prompt do deepresearch, inclua explicitamente a regra:

> “Não invente paths. Só referencie arquivos que você viu no repo clonado.”

---

## Sobre seu “bug em worktree”

O código que você colou do worktree em si não grita bug óbvio, mas o **tipo de bug mais comum aqui** é:

* branch base existe **remotamente** mas não existe como `refs/heads/<base>` local
  e você faz `show-ref --verify refs/heads/${base}`

Isso falha se o user só tem `origin/main` e não tem branch local.

✅ Fix clássico:

* tentar `refs/heads/base` **ou** `refs/remotes/origin/base`
* ou fazer `git fetch origin base:base` sob flag `--fetch-base` (mais seguro)

Se você me disser o sintoma (mensagem de erro/exit code), eu te dou o patch exato.

---

## Fechando: minhas respostas às “User Review Required” do seu doc

### CLI Command Decision

✅ **Both**, com:

* **core**: `nooa check --profile <yaml>`
* **alias**: `nooa guardrail` chamando o check internamente

### Scope Decision (Phase 3)

* **OpenSpec-like**: ✅ sim, mas minimalista (pasta + init + validate)
* **SQLite indexing**: ⚠️ opcional P3 somente com evidência de gargalo (medição)

---

Se você quiser, eu te devolvo esse plano já “ajustado” no formato de um **PR-ready spec** (com nomes finais de pastas, exit codes, schema do JSON report e checklist TDD), mas sem inventar nenhum path do Auditor — só com base no que você já tem no NOOA hoje.
