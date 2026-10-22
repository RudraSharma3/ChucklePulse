# Feature Implementation Playbook

Follow this playbook when designing and implementing a new feature or significant enhancement.

---

## 1. Discover & Scope

1. Read `AGENTS.md`, `docs/architecture.md`, and relevant decisions in `docs/decisions/`.
2. Define clear, testable acceptance criteria in `docs/task-state.md`.
3. Check `docs/lessons.md` and active learned rules for relevant constraints.

## 2. Architectural Design (If Material)

1. If the feature alters interfaces, adds dependencies, or changes data storage, trigger the **Architect** role (`prompts/architect.md`).
2. Evaluate 2 or fewer viable approaches with trade-offs.
3. If an architectural decision is made, draft an ADR in `docs/decisions/` and obtain user approval.

## 3. Single-Owner Implementation

1. Assign one **Implementer** agent (`prompts/implementer.md`) to write code.
2. Make focused, minimal edits adhering to `docs/conventions.md`.
3. Write unit and integration tests alongside feature code.

## 4. Verification & Independent Review

1. Execute test suites, linters, and type checkers.
2. For significant changes, invoke the **Reviewer** (`prompts/reviewer.md`) and **Tester** (`prompts/tester.md`) to perform falsification and edge-case testing.
3. Review git diff to ensure no regressions, unintended files, or secrets exist.

## 5. Learning & Handoff

1. If unexpected difficulties or wrong assumptions occurred, record candidates in `.ai/mistakes-candidates.md`.
2. Update `docs/architecture.md` if the system structure changed.
3. Complete `docs/task-state.md` and provide a concise handoff summary to the user.
