# Architecture Decisions Playbook

Follow this playbook when evaluating trade-offs and authoring Architecture Decision Records (ADRs).

---

## 1. When to Author an ADR

Author an ADR when a decision involves:
- Introducing, changing, or removing a major dependency or framework.
- Choosing a persistence, caching, or data modeling strategy.
- Defining or modifying API communication protocols, authentication, or trust boundaries.
- Setting structural conventions that affect multiple modules or repositories.
- Incurring significant technical debt or intentional architectural trade-offs.

Do NOT author an ADR for trivial routine code changes, bug fixes, or minor variable/function renamings.

## 2. Decision Authoring Process

1. Copy `docs/decisions/000-template.md` to `docs/decisions/NNN-<decision-title>.md` (sequential 3-digit number).
2. Document the **Context**: Why is this decision required? What forces and constraints exist?
3. Document the **Considered Options**: Compare at least two viable approaches with pros and cons.
4. Document the **Decision**: State clearly what was chosen and why.
5. Document the **Consequences**: Highlight positive benefits, negative trade-offs, and follow-up work.

## 3. Review & Approval

1. Present the draft ADR to the user or team for review.
2. Update status from `Proposed` to `Accepted` upon consensus.

## 4. Superseding Existing Decisions

When a new decision replaces an earlier one:
1. Mark the old ADR's status as `Superseded by ADR NNN`.
2. Reference the old ADR in the new record's context.
3. Never delete historical ADRs.
