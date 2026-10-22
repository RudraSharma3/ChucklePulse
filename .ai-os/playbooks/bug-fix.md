# Bug Fix Playbook

Follow this playbook to investigate, isolate, reproduce, fix, and learn from software defects.

---

## 1. Reproduce and Document

1. Capture:
   - Expected behavior
   - Actual behavior
   - Exact steps to reproduce (or automated failing test case)
   - Relevant logs, error traces, or screenshots
2. Record the issue details in `docs/task-state.md`.

## 2. Root Cause Analysis

1. Trace execution flow through relevant files without making premature edits.
2. Formulate a hypothesis for why the failure occurred.
3. Validate the hypothesis with targeted inspection or debug logs.
4. Distinguish between symptoms and root cause.

## 3. Create Regression Test

1. Write a minimal automated test that reliably reproduces the failure (asserting expected behavior).
2. Confirm that the test fails against the current unmodified codebase.

## 4. Minimal Surgical Fix

1. Apply the smallest correct change to resolve the root cause.
2. Ensure no unrelated logic is modified.
3. Verify that the regression test now passes.

## 5. Full Suite Verification

1. Run the entire test suite, linter, and typechecker to prevent regressions.
2. Review the diff.

## 6. Learning Loop Trigger

1. Determine why the bug occurred:
   - Was it a false assumption?
   - Was an existing architectural pattern misunderstood?
   - Was there a missing edge-case check?
2. If the finding is reusable, follow `playbooks/learning-loop.md` to record a candidate lesson in `.ai/mistakes-candidates.md`.
