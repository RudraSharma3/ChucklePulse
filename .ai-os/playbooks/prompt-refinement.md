# Prompt Refinement, Reverse Prompting & Prompt Contract Playbook

Follow this playbook whenever the user provides an informal, brief, ambiguous, or non-trivial prompt. The AI Operating System automatically transforms conversational input into a rigorous, production-grade **Prompt Contract** (GOAL, CONSTRAINTS, FORMAT, FAILURE) and applies **Reverse Prompting** to eliminate blind assumptions before modifying code.

---

## 🔄 The Complete Prompt Optimization Lifecycle

```
                     MESSY / AMBIGUOUS USER PROMPT
                                   │
                                   ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  PHASE 1: REVERSE PROMPTING (Clarification Gate)                │
  │  • Analyze: Stated vs Implicit, Decision Points, Failure Modes  │
  │  • Ask 3–5 Non-Intuitive, Concrete, Opinionated Questions       │
  └────────────────────────────────┬────────────────────────────────┘
                                   │ User Answers / Confirms
                                   ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  PHASE 2: PROMPT CONTRACT FORMULATION                           │
  │  • 🎯 GOAL:        Quantifiable success & concrete deliverable   │
  │  • ⛓️ CONSTRAINTS: Tech stack, performance limits, typing rules │
  │  • 📁 FORMAT:      Exact file paths, component structure        │
  │  • ❌ FAILURE:     Forbidden shortcuts & mandatory edge cases   │
  └────────────────────────────────┬────────────────────────────────┘
                                   │
                                   ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  PHASE 3: TRANSPARENT CONTRACT PRESENTATION                     │
  │  • Display structured Prompt Contract to user in chat           │
  │  • Record active contract into docs/task-state.md               │
  └────────────────────────────────┬────────────────────────────────┘
                                   │
                                   ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  PHASE 4: SURGICAL EXECUTION & ANTI-SHORTCUT VERIFICATION       │
  │  • Implement against contract as hard engineering spec          │
  │  • Verify every single FAILURE condition is avoided             │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 1. Phase 1: Reverse Prompting (The Clarification Gate)

Whenever a task has multiple viable approaches, implicit trade-offs, or unspecified edge cases, **never silently guess**. Execute Reverse Prompting:

### 1.1 When to Trigger:
- Building, implementing, or refactoring non-trivial components/services.
- When requirements have multiple architectural forks or taste-dependent choices.
- User says: *"Build a notification system"*, *"Add checkout flow"*, *"Make an analytics dashboard"*.
- **Do NOT trigger for**: Single-line bug fixes, typos, simple lookups, or when the user already provided an explicit contract.

### 1.2 Step 1: Analyze the Request (Silent Pre-Analysis)
Before generating questions, silently identify:
- **Stated Requirements**: What the user explicitly requested.
- **Implicit Assumptions**: What you are about to assume without being told.
- **Decision Points**: Where multiple valid architectural paths exist.
- **Failure Modes**: What could go wrong or feel broken to the user.
- **Taste-Dependent Choices**: Where personal preference determines the right answer.

### 1.3 Step 2: Generate Clarifying Questions
All questions must strictly adhere to the **4 Question Standards**:

1. **Non-Intuitive**: Don't ask what is already in context or obvious.
   - *Bad:* *"What language should I use?"* (Obvious from repo).
   - *Good:* *"When a network request times out, should this fail silently, show an inline retry banner, or trigger a global toast?"*
2. **High-Impact**: Every question must meaningfully alter the code implementation. Skip trivial questions that don't change the architecture.
3. **Concrete**: Reference specific scenarios and edge cases, not vague abstractions.
   - *Bad:* *"How should errors be handled?"*
   - *Good:* *"If the API returns a 429 rate limit, should we retry with exponential backoff or queue in background storage?"*
4. **Opinionated (With Recommended Defaults)**: Always provide your recommended choice so the user can just say "yes" to defaults.
   - *Format:* *"I recommend Option A: [Description] — want something different?"*

### 1.4 Categories to Draw Questions From:
- **Edge Case Behavior**: What happens when APIs fail, inputs are empty, or payload exceeds limits?
- **Scope Boundaries**: What is strictly IN scope vs. explicitly OUT of scope?
- **Integration Points**: How this connects to existing database tables, routes, and state stores (`docs/architecture.md`).
- **Format & UI/UX Preferences**: Optimistic UI updates vs. blocking spinners, drawer vs. modal.
- **Performance vs. Simplicity Trade-offs**: Client-side filtering vs. server-side pagination.
- **Security & Permissions**: Role-based access control, RLS policies, input sanitization.

---

## 2. Phase 2: The 4-Section Prompt Contract

Once clarified, synthesize the user intent, codebase architecture (`docs/architecture.md`), and conventions (`docs/conventions.md`) into a formal contract:

```markdown
## 📋 Prompt Contract: [Feature / Task Name]

### 🎯 GOAL:
[Quantifiable success metric. Include concrete deliverable. "Working X" is not a goal. "X that handles Y at Z performance" is.]

### ⛓️ CONSTRAINTS:
- [Hard limit 1 - language, dependencies, compatibility from docs/architecture.md]
- [Hard limit 2 - performance, size, complexity ceiling]
- [Hard limit 3 - integration requirements, existing patterns from docs/conventions.md]
- [Hard limit 4 - learned user preferences from AGENTS.md ## Learned Rules]

### 📁 FORMAT:
- [Exact file paths to create or modify]
- [What each file contains and component responsibilities]
- [Typing, tests, and CSS variable styling tokens]

### ❌ FAILURE (Any of these = Task Incomplete & Rejected):
- [Specific lazy shortcut the AI would be tempted to take, e.g. leaving // TODO]
- [Edge case that must be handled and not skipped, e.g. empty states, null safety]
- [Integration point that must actually work, not just compile]
- [The "technically works but crashes in production" outcome that must be avoided]
```

---

## 3. Phase 3: Present Contract & Save to Task State

1. **In Chat**: Output the structured Prompt Contract block before modifying code so the user sees the restructured specification.
2. **In Repository**: Append the active contract and acceptance criteria checklist `[ ]` into `docs/task-state.md`.

---

## 4. Phase 4: Execute & Verify Against FAILURE Checklist

1. **Implement as a Strict Specification**: Treat the contract as an engineering blueprint, not an optional suggestion.
2. **Anti-Shortcut Verification**: Before declaring success, systematically review the **`FAILURE`** section:
   - [ ] Are all `// TODO` or placeholder mocks eliminated?
   - [ ] Are loading, error, and empty states rendered?
   - [ ] Is input sanitized against injection/XSS?
   - [ ] Are all affected tests passing?
3. **Update Task State**: Check off completed items in `docs/task-state.md` and report verified progress.
