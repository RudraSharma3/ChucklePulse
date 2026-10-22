# Learning Loop Playbook

Follow this playbook to safely record, validate, promote, and supersede learned engineering lessons without allowing naive self-modification.

---

## 1. Triggering the Learning Loop

The learning loop is triggered when:
- The user explicitly corrects an agent's assumption or output.
- An agent encounters a bug or test failure caused by a mistaken assumption.
- The user expresses a recurring preference across tasks.
- A repeated friction or missed constraint is observed during implementation.

## 2. Capture Candidate Lesson

Do NOT immediately write a permanent rule to `AGENTS.md`.

Instead, append a candidate entry to `.ai/mistakes-candidates.md`:

```markdown
| Date | Failure | Cause | Detection | Proposed Prevention | Status |
| 2026-09-13 | Ran npm instead of bun | Assumed npm default | Command failed | [CODE] Always use bun for package commands | Candidate |
```

## 3. The 10-Point Quality Check

Before any candidate is promoted to permanent project knowledge or `AGENTS.md`, evaluate all 10 criteria:

1. **Reusability**: Is this lesson useful across multiple sessions?
2. **Evidence**: Is it grounded in a real, documented observation?
3. **Actionability**: Does it tell future agents specifically what to do or avoid?
4. **Generality**: Is it free of narrow, one-off task details?
5. **Scope Accuracy**: Is it classified correctly (`UNIVERSAL`, `REPOSITORY`, `PROJECT`, `TASK`)?
6. **No Redundancy**: Does an existing rule already cover this?
7. **No Conflict**: Does it contradict an existing rule without explanation?
8. **Safety**: Does it promote secure, reliable behavior?
9. **Zero Secrets**: Is it 100% free of credentials, API keys, tokens, or private data?
10. **Durability**: Will this rule still be valid months from now?

If any check fails or is uncertain, keep as candidate or discard.

## 4. Promotion Paths

- **Project Lesson**: If verified and relevant to the project, record in `docs/lessons.md`.
- **Permanent Canonical Rule**: If verified, broadly applicable across almost every task, and durable, add to the `Learned Rules` section of `AGENTS.md` following sequential numbering and category tags:
  ```markdown
  N. [CATEGORY] Rule description — rationale.
  ```

## 5. Superseding Obsolete Rules

If a new rule replaces an earlier rule:
1. Do NOT delete the old rule.
2. Mark the old rule with `- SUPERSEDED BY RULE N`.
3. Append the new rule with an explanation of the migration.
