# Multi-Agent MCP Orchestration Playbook

This playbook establishes the operational protocol for coordinating multiple specialized AI models using the **Model Context Protocol (MCP)** under a Manager-Worker or Router architecture.

---

## Architecture Overview

```
                      TASK INPUT
                          │
                          ▼
             ┌─────────────────────────┐
             │   ROUTER DECISION HUB   │
             │   (Right Model for Job) │
             └────────────┬────────────┘
                          │
      ┌───────────────────┼───────────────────┬───────────────────┐
      ▼                   ▼                   ▼                   ▼
Need Multimodal /   Need Complex        Need Sandboxed      Need Real-Time
Large Context?      Reasoning?          Code / Tests?       Web Data?
      │                   │                   │                   │
[Gemini Worker]     [Claude Manager]    [Codex Worker]      [Perplexity]
      │                   │                   │                   │
      └───────────────────┼───────────────────┴───────────────────┘
                          ▼
            ┌───────────────────────────┐
            │   COLLECT & VALIDATE      │
            │   (Claude Manager)        │
            └─────────────┬─────────────┘
                          │
                   Consistent?
                   ├── Yes ──▶ Merge Changes ──▶ Done
                   └── No  ──▶ Manager Fixes Integration Issues
```

---

## 1. The Core Roles

1. **The Manager (Planner & Reasoner - e.g. Claude 3.7 / Opus)**:
   - Owns task decomposition, architectural design, and final integration.
   - Authors the **Contract Specification** before delegating.
   - Evaluates worker outputs, resolves discrepancies, and merges.
2. **Worker 1 (UI & Frontend - e.g. Gemini 2.0 / 1.5 Flash)**:
   - Optimized for rapid frontend rendering, UI components, styling, and visual/multimodal assets.
3. **Worker 2 (API & Backend - e.g. Codex / Claude Implementer)**:
   - Optimized for database schemas, server endpoints, business logic, and migrations.
4. **Worker 3 (Tester & Falsifier - e.g. Codex / Test Specialist)**:
   - Optimized for generating regression suites, edge-case harnesses, and integration tests.

---

## 2. The Non-Negotiable Contract-First Protocol

To prevent merge conflicts and incompatible code between parallel workers:

1. **Manager Authors Contract First**:
   Before dispatching tasks, the Manager MUST define the exact interface types and schemas in `docs/architecture.md` (e.g., TypeScript interfaces, REST endpoints, Pydantic schemas).
2. **Isolated Workspaces / Files**:
   - Worker 1 is assigned only frontend files (e.g. `src/components/`, `src/views/`).
   - Worker 2 is assigned only backend files (e.g. `src/api/`, `src/services/`).
   - Worker 3 is assigned only test files (e.g. `tests/`).
3. **No Overlapping Concurrent Edits**: Two workers must NEVER edit the same file at the same time.

---

## 3. The 4-Stage Multi-Agent Lifecycle

### Stage 1: Deconstruct & Route
The Manager receives the user prompt, optimizes it via `playbooks/prompt-refinement.md`, and splits it into decoupled subtasks mapped to the best model.

### Stage 2: Parallel Dispatch via MCP
Subtasks are dispatched via MCP tools to worker agents with explicit file boundaries and the shared contract schema.

### Stage 3: Collect & Falsify
The Manager collects all generated files and runs the test suite (`playbooks/testing.md`).

### Stage 4: Integration Review & Merge
The Manager checks:
- Do frontend and backend conform to the schema in `docs/architecture.md`?
- Do automated tests pass cleanly?
- If errors exist, the Manager applies surgical fixes and commits the unified change.
