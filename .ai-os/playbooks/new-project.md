# New Project Playbook

Follow this step-by-step procedure to bootstrap a new AI-assisted software repository using the AI Operating System.

---

## 1. Copy Template Files

Copy the entire `templates/project/` directory into the new project's root:

```bash
# Example copy command
cp -r /path/to/ai-operating-system/templates/project/. /path/to/new-project/
```

Verify that the target repository contains:
- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `CODEX.md`
- `.ai/mistakes-candidates.md`
- `docs/architecture.md`, `docs/conventions.md`, `docs/lessons.md`, `docs/task-state.md`, `docs/decisions/000-template.md`

## 2. Define Project Purpose and Commands

Edit the project's root `AGENTS.md`:
1. Document the clear project purpose and target problem.
2. Fill in exact build, test, lint, and run commands.
3. Establish project-specific engineering rules.

## 3. Document Architecture & Conventions

1. Complete `docs/architecture.md` with system boundaries, components, data flows, and security constraints.
2. Complete `docs/conventions.md` with language choices, code styles, and git workflows.

## 4. Author Initial Architecture Decision Records (ADRs)

If the initial project setup involves material trade-offs (e.g., choice of framework, database, authentication provider), create an ADR in `docs/decisions/001-<decision-name>.md` using `000-template.md`.

## 5. Validate Baseline and Commit

1. Run the project's build and test commands to verify a green baseline.
2. Commit the initialized repository structure to git:
   ```bash
   git add .
   git commit -m "Initialize project with AI Operating System"
   ```
3. Register the project in the global `registry/projects.md`.
