# nooa guardrail

Auditoria de código baseada em perfis declarativos (YAML).

O comando `guardrail` permite definir regras de conformidade, segurança e qualidade que o código deve seguir. Ele suporta padrões de busca por expressão regular (regex) ou literal, com filtragem por escopo (globs).

## Uso

```bash
nooa guardrail <subcommand> [options]
```

### Subcomandos

| Comando | Descrição |
|---------|-----------|
| `check` | Verifica o código contra perfis de guardrail |
| `validate` | Valida o esquema de um perfil YAML |
| `init` | Inicializa o diretório `.nooa/guardrails` |

---

## `nooa guardrail check`

Executa a auditoria no diretório atual.

### Opções

- `--profile, -p <path>`: Caminho para um perfil YAML específico.
- `--spec`: Usa o arquivo `GUARDRAIL.md` para combinar múltiplos perfis.
- `--watch, -w`: Modo contínuo (re-executa ao alterar arquivos).
- `--json`: Saída estruturada em JSON.
- `--deterministic`: Garante saída idêntica bytes a byte (padrão com `--json`).

### Exemplos

```bash
# Executa os guardrails definidos no GUARDRAIL.md
nooa guardrail check --spec

# Executa um perfil específico
nooa guardrail check --profile .nooa/guardrails/profiles/security.yaml

# Modo contínuo salvando em JSON
nooa guardrail check --spec --watch --json > report.json
```

---

## `nooa guardrail validate`

Verifica se um arquivo de perfil é sintaticamente correto.

### Opções

- `--profile, -p <path>`: Caminho para o perfil a validar (obrigatório).

### Exemplo

```bash
nooa guardrail validate --profile custom-rules.yaml
```

---

## Estrutura de um Perfil (YAML)

Um perfil (`.yaml`) define uma lista de regras:

```yaml
refactor_name: security
description: Regras de segurança
rules:
  - id: no-eval
    description: O uso de eval() é proibido
    severity: high
    match:
      anyOf:
        - type: regex
          value: "\\beval\\s*\\("
    scope:
      exclude:
        - "**/*.test.ts"
```

## GUARDRAIL.md (Spec)

O arquivo `GUARDRAIL.md` na raiz do projeto permite automatizar a execução de múltiplos profiles:

```markdown
# GUARDRAIL.md

## Profiles
- [security](file://./.nooa/guardrails/profiles/security.yaml)
- [zero-preguica](file://./.nooa/guardrails/profiles/zero-preguica.yaml)

## Exclusions
- "**/vendor/**"
```
