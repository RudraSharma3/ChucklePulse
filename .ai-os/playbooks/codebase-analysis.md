# Codebase Analysis Playbook

Follow this playbook when entering an unfamiliar, large, or legacy codebase to build accurate mental models without making premature modifications.

---

## 1. Map Top-Level Structure

1. List the repository root and top-level directory structure.
2. Read project documentation: `README.md`, `AGENTS.md`, `docs/architecture.md`, and configuration files (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, etc.).
3. Identify the technology stack, framework, build tools, and test harness.

## 2. Identify Entry Points and Key Boundaries

1. Locate the application entry points (e.g., `main.py`, `index.ts`, `cmd/server/main.go`, `App.tsx`).
2. Map core architectural layers:
   - Presentation / API routes / Controllers
   - Business logic / Services / Domains
   - Data access / Models / Database migrations
   - External integrations / Third-party clients
   - Background tasks / Queues

## 3. Map Data Flow and State Management

1. Trace a standard request/interaction lifecycle end-to-end (from user input to database persist/return).
2. Identify state stores, caching layers, and database connections.
3. Identify authentication/authorization mechanisms and security boundaries.

## 4. Evaluate Test Coverage & Tooling

1. Locate existing tests (`tests/`, `__tests__/`, `*_test.go`).
2. Run test and lint commands to check project health.
3. Identify missing test areas or brittle test setups.

## 5. External Research & Source Triangulation

When researching unfamiliar libraries or APIs, follow the **Source Triangulation Standard**:
1. **Tier 1 (Official Authority)**: Consult official documentation and API type definitions.
2. **Tier 2 (Recency Check)**: Check GitHub release notes/changelogs to confirm non-deprecated syntax.
3. **Tier 3 (Production Gotchas)**: Check GitHub issues and community discussions for known edge cases.
4. Filter out sources older than 2 years for fast-evolving frameworks.

## 6. Record Findings & Generate Dependency Graph

1. Synthesize architecture findings into `docs/architecture.md`.
2. Generate or update visual component flows and call paths in `docs/graph.md` (Mermaid diagrams + blast radius matrix).
3. Highlight constraints, existing conventions, and risks before proposing any code changes.

---

## 7. Output Developer Greeting & Immediate Next Steps

Before rendering the greeting, run `scripts/doctor.sh` (or `scripts/doctor.ps1`) or inspect git configuration. Derive the `ARMOR` status dynamically:
- `Git Secret Guard [ARMED]` — If `.githooks/pre-commit` is installed and `core.hooksPath` is active.
- `Git Secret Guard [UNARMED]` — If hooks are missing or unconfigured.

Output the developer confirmation banner and guide the engineer on what to do next:
````markdown
```text
┌──────────────────────────────────────────────────────────────┐
│  AI-OS v2.0 (by Rudra Sharma) // KERNEL ONLINE               │
├──────────────────────────────────────────────────────────────┤
│  REPO:   <project-name>                                      │
│  STACK:  <Detected Tech Stack, e.g. Next.js • Tailwind>      │
│  MEMORY: docs/architecture.md & docs/graph.md [SYNCED]       │
│  ARMOR:  Git Secret Guard [<ARMED or UNARMED>]               │
└──────────────────────────────────────────────────────────────┘
```

```bash
[✔] Full codebase structure & entry points indexed
[✔] Architecture & API routes mapped to docs/architecture.md
[✔] Visual Mermaid dependency graph generated in docs/graph.md
[✔] Team conventions & test commands recorded in docs/conventions.md
[✔] Active task tracking initialized in docs/task-state.md
```

⚡ **AI-OS by Rudra Sharma is now actively operating in the background!**

---

### 🚀 What would you like to tackle first?

1. **Build a Feature**: Type your idea casually (e.g. *"Add user auth with OAuth"* or `/feature <idea>`) — I will auto-refine it into a full spec in `docs/task-state.md` with error boundaries and tests before writing code.
2. **Fix a Bug**: Tell me what broke (e.g. *"The date filter fails on month-end"*) — I will run root-cause analysis via `playbooks/bug-fix.md`.
3. **Run a Security Audit**: Type `/audit` — I will scan all routes, database models, and inputs for vulnerabilities and secret leaks.
4. **Architectural Planning**: Type `/interview <new idea>` — I will run a 4-question architectural design interview before touching code.

**Tell me what you'd like to work on, and let's start shipping!**
````

