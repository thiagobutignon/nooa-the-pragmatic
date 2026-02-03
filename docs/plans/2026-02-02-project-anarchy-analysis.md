# Project Anarchy Analysis: Adversarial Test Repository

> **Date**: 2026-02-02
> **Purpose**: Deep analysis of TheAuditorTool/project_anarchy for guardrail pattern extraction
> **Status**: Benchmark-only (NO LICENSE - cannot copy directly)

---

## 1. Repository Overview

**project_anarchy** is a purpose-built adversarial testing repository designed to benchmark code auditing tools. It contains **403 intentional errors** organized across 55+ phases, representing real-world security vulnerabilities, code smells, and anti-patterns found in production codebases.

### 1.1 Statistics

| Metric | Value |
|--------|-------|
| Total Errors | 403 |
| Phases | 55 |
| Languages | Python, Rust, Node.js, JavaScript, TypeScript |
| Architecture | Polyglot microservices with gateway |
| Size | 6.65 MiB (6145 objects) |

### 1.2 Repository Structure

```
project_anarchy/
├── AGENTS.md              # AI agent configuration
├── ARCHITECTURE.md        # System architecture (17KB)
├── CLAUDE.md              # Claude-specific instructions (10KB)
├── README.md              # Error catalog (75KB)
├── api/                   # Python FastAPI backend
├── frontend/              # JavaScript/React frontend
├── gateway/               # Node.js Express gateway
├── python_pipeline/       # Python data processing
├── rust_backend/          # Rust Actix backend
├── anarchy_commerce/      # Alternative polyglot setup
├── frameworks/            # Framework-specific tests
├── graph_nightmares/      # Graph analysis targets
├── security/              # Security vulnerability demos
├── tests/                 # Test fixtures and flaky tests
├── docker-compose.yml     # Service orchestration
├── Cargo.toml             # Rust workspace
├── pyproject.toml         # Python project config
└── package.json           # Node.js dependencies
```

---

## 2. Error Categories Discovered

### 2.1 Dependency Errors (21 total)

These errors relate to package management and dependency resolution.

| Error Type | Example | Detection Method |
|------------|---------|------------------|
| **Typosquatting** | `requets` instead of `requests` | Package name comparison |
| **Known CVEs** | `fastapi==0.68.0` with vulnerabilities | CVE database lookup |
| **Version Mismatch** | Different versions in requirements.txt vs pyproject.toml | Cross-file comparison |
| **Git Dependencies** | `moment.git#develop` (mutable branch) | URL pattern matching |
| **Committed node_modules** | Full dependency tree in repo | Gitignore validation |
| **Outdated Versions** | `numpy==0.0.001` | Version freshness check |

### 2.2 Security Errors (17+ total)

Critical vulnerabilities that could be exploited.

| Error Type | Location | Pattern |
|------------|----------|---------|
| **Hardcoded Secrets** | api/app.py:14 | `sk-xxxxxxxxxxxxxxxxxxxxxxxx_very_secret_key` |
| **SQL Injection** | api/db.py:20 | f-string in SQL: `f"SELECT * FROM users WHERE id={user_id}"` |
| **Command Injection** | rust_backend/main.rs:109 | Unsanitized command execution |
| **Path Traversal** | rust_backend/main.rs:143 | `../../../etc/passwd` access |
| **Code Injection** | python_pipeline/data_ingestion.py:33 | `eval()` with user input |
| **SSRF** | rust_backend/main.rs:240 | Unvalidated external URL fetch |
| **AWS Credentials** | .env | `AWS_ACCESS_KEY_ID` exposed |
| **Commented CSRF** | config_loader.py:17-18 | `# CSRF_ENABLED = True` |

### 2.3 Code Quality Errors (30+ total)

Patterns that indicate poor code quality or maintainability issues.

| Error Type | Example | Impact |
|------------|---------|--------|
| **Excessive Parameters** | `get_user_details(a,b,c,d,e,f,g,h)` | Hard to maintain |
| **Deep Nesting** | 5+ levels of if/for | Cognitive complexity |
| **Circular Dependencies** | A→B→C→A import cycle | Build/test issues |
| **God Objects** | Tight coupling between modules | Refactoring difficulty |
| **Global Mutable State** | `cache = {}` at module level | Race conditions |
| **Empty Catch Blocks** | `except: pass` | Silent failures |
| **Console Logs** | `console.log()` in production | Information leakage |

### 2.4 Async/Resource Errors (15+ total)

| Error Type | Example | Consequence |
|------------|---------|-------------|
| **Missing Await** | `notify_system(user_id)` without await | Race conditions |
| **Unhandled Promises** | `.then()` without `.catch()` | Unhandled rejections |
| **Resource Leaks** | `open(file)` without close | File descriptor exhaustion |
| **N+1 Queries** | Loop with individual queries | Performance degradation |
| **Deadlock Patterns** | Lock A→B, B→A | System hangs |

### 2.5 Test Quality Errors (10+ total)

| Error Type | Example | Problem |
|------------|---------|---------|
| **No Assertions** | Test without expect/assert | False passing |
| **External API Calls** | Tests hitting github.com | Flaky tests |
| **Global State Mutation** | Modifying shared counter | Test pollution |
| **Hardcoded Paths** | `/home/user/projects/...` | CI failures |
| **Flaky Tests** | Random timing dependencies | Unreliable builds |

### 2.6 Evidence/Documentation Errors (5+ total)

False claims in documentation that don't match reality.

| Claim | Reality |
|-------|---------|
| "All user input is sanitized" | SQL injection exists |
| "Robust connection pool" | No pooling implemented |
| "Rate limiting on all endpoints" | No rate limiting code |
| "Async operations properly awaited" | Missing awaits found |

---

## 3. Cross-Boundary Data Flow Analysis

The repository is designed to test **taint analysis** across service boundaries.

### 3.1 Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        project_anarchy/                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  frontend/services/api_service.js                                    │
│       │                                                              │
│       │ fetch()                                                      │
│       ▼                                                              │
│  ┌─────────────┐                                                     │
│  │   gateway/  │  :4000 (Node.js/Express)                           │
│  │  src/index.js                                                     │
│  └──────┬──────┘                                                     │
│         │                                                            │
│    ┌────┴─────┬─────────────┬─────────────┐                         │
│    │          │             │             │                         │
│    ▼          ▼             ▼             ▼                         │
│ ┌──────┐  ┌────────────┐  ┌─────────────────┐                       │
│ │ api/ │  │python_     │  │ rust_backend/   │                       │
│ │:8000 │  │pipeline/   │  │ :8080           │                       │
│ └──────┘  └────────────┘  └─────────────────┘                       │
│                                                                      │
│  Connected: ~90 errors with real taint flows                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Documented Taint Flows

| Vulnerability | Source | Path | Sink |
|---------------|--------|------|------|
| SQL Injection | `searchUsers(term)` | frontend → gateway → api/app.py | db.py:18 |
| Command Injection | `executeCommand(cmd)` | frontend → gateway → rust | main.rs:109 |
| Path Traversal | `readFile(path)` | frontend → gateway → rust | main.rs:143 |
| Code Injection | `importCSV(path)` | frontend → gateway → python | data_ingestion.py:33 |
| SSRF | `fetchExternalUrl(url)` | frontend → gateway → rust | main.rs:240 |

---

## 4. AGENTS.md Analysis

The repository includes agent configuration for TheAuditor tool.

### 4.1 Agent Triggers

```markdown
- "refactor", "split", "extract" => refactor.md
- "security", "vulnerability", "XSS" => security.md
- "plan", "architecture", "design" => planning.md
- "dataflow", "trace", "flow" => dataflow.md
```

### 4.2 Agent Principles

1. **NO file reading** - Use database queries instead
2. **NO guessing patterns** - Follow detected precedents
3. **MANDATORY sequence** - blueprint → query → synthesis
4. **ALL recommendations** must cite database results

---

## 5. Relevance to NOOA

### 5.1 Patterns We Already Detect

| Pattern | NOOA Status | Location |
|---------|-------------|----------|
| Hardcoded secrets | ✅ | security.yaml |
| SQL injection | ✅ Basic | security.yaml |
| console.log | ✅ | dangerous-patterns.yaml |
| eval() usage | ✅ | security.yaml |
| debugger statements | ✅ | dangerous-patterns.yaml |
| TODO/FIXME | ✅ | zero-preguica.yaml |

### 5.2 Patterns We Should Add

| Pattern | Priority | Complexity |
|---------|----------|------------|
| AWS/GCP credentials | P0 | Low (regex) |
| Private key detection | P0 | Low (literal) |
| Git dependencies | P1 | Low (regex) |
| Typosquatting warnings | P1 | Medium (dictionary) |
| Tests without assertions | P2 | Low (regex) |
| External API in tests | P2 | Low (regex) |

### 5.3 Patterns Beyond Current Scope

These require AST parsing, not regex:

- Circular dependencies
- N+1 query detection
- Missing await detection
- Resource leak tracking
- Dead code detection

---

## 6. Recommendations

### 6.1 Immediate Actions (P0)

1. Create `anarchy-baseline.yaml` with 8-10 new rules
2. Add AWS, GCP, Stripe secret patterns
3. Add private key header detection
4. Add git dependency warnings

### 6.2 Short-term Actions (P1)

1. Create `dependency-risks.yaml` profile
2. Add test smell patterns
3. Document adversarial testing approach

### 6.3 Long-term Actions (P2+)

1. Evaluate tree-sitter for AST parsing
2. Consider SQLite indexing for large codebases
3. Build cross-file analysis capability

---

## 7. Conclusion

project_anarchy is an invaluable resource for benchmarking code auditing tools. While we cannot copy any code due to the missing license, we can:

1. **Learn** from the categorization of 403 error types
2. **Benchmark** our detection against their documented patterns
3. **Reimplement** patterns independently based on observed categories
4. **Test** our guardrails against similar adversarial fixtures

The main gaps in NOOA's current detection are:
- Enhanced secret patterns (AWS, GCP, private keys)
- Dependency security (git URLs, typosquatting)
- Test quality (no assertions, external calls)
- Cross-file analysis (circular deps, N+1 queries)

Priority should be given to regex-based enhancements (P0-P1) before considering AST-based analysis (P2+).
