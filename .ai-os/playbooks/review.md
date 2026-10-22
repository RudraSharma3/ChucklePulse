# Code Review Playbook

Follow this playbook when performing independent verification and review of changes under the **Reviewer** or **Security Reviewer** role.

---

## 1. Review Context & Scope

1. Read the user request, acceptance criteria, and active task state.
2. Read the full git diff of modified, added, and deleted files.
3. Check against active rules in `AGENTS.md` and `docs/conventions.md`.

## 2. Review Dimensions

Evaluate the changes across five primary criteria:

1. **Correctness & Completeness**:
   - Do the changes fully satisfy all acceptance criteria?
   - Are edge cases and error states handled properly?
2. **Architecture & Design**:
   - Does the implementation respect established boundaries and layering?
   - Are unnecessary dependencies or circular references introduced?
3. **Security & Data Safety**:
   - Are any secrets, keys, or credentials committed?
   - Are untrusted inputs sanitized and validated?
   - Are authentication and authorization checks preserved?
4. **Code Quality & Maintainability**:
   - Is the code readable, idiomatically structured, and well-named?
   - Is duplication avoided without premature abstraction?
5. **Testing & Verification**:
   - Are automated tests included for new or modified behavior?
   - Do tests verify real behavior rather than mocking out the core logic?

## 3. Format Review Findings

Structure review comments in priority order:

- **[BLOCKER]**: Serious bugs, security vulnerabilities, breaking changes, or regressions that must be resolved before proceeding.
- **[IMPORTANT]**: Architectural deviations, missing edge cases, or lack of critical test coverage.
- **[SUGGESTION]**: Minor cleanups, readability improvements, or non-blocking optimizations.
- **[VERIFIED]**: Explicit confirmation of what was checked and found sound.

Include exact file references, line numbers, and actionable correction snippets for every finding.
