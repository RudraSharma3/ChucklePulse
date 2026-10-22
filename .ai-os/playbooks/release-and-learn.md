# Milestone Release & Lesson Harvester Playbook

Follow this playbook when completing a significant project milestone, shipping a release, or closing out a development sprint.

---

## 1. The 5-Step Release & Learning Protocol

```
  [1. Full Test Suite] ──▶ [2. Git Diff Audit] ──▶ [3. Generate Changelog]
                                                            │
  [5. Clean Git Commit] ◀── [4. Harvest Lessons] ◀──────────┘
```

---

## 2. Step-by-Step Procedure

### Step 1: Run Full Verification Suite
1. Run all unit, integration, and e2e test suites.
2. Run linters and typecheckers to verify zero compile or type errors.

### Step 2: Audit Git Changes & Security
1. Run `git status` and inspect staged diffs.
2. Verify zero credentials, private keys, or `.env` files are staged.
3. Verify that `docs/graph.md` and `docs/architecture.md` accurately reflect all newly added modules.

### Step 3: Generate Markdown Changelog
Summarize changes into a release note in `docs/task-state.md` or `CHANGELOG.md`:
- **Added**: New user-facing features and endpoints.
- **Fixed**: Bug fixes and edge-case resolutions.
- **Changed**: Architectural or schema migrations.

### Step 4: Harvest Candidate Lessons
1. Review `.ai/mistakes-candidates.md`.
2. Evaluate candidates against the **10-Point Quality Check** (`playbooks/learning-loop.md`).
3. Promote verified, reusable lessons to `docs/lessons.md` or `AGENTS.md`.

### Step 5: Tag & Commit
1. Finalize `docs/task-state.md` with milestone completion status.
2. Create a clean git release commit.
