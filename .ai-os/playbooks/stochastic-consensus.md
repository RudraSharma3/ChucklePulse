# Stochastic Multi-Agent Consensus Playbook

Follow this playbook when facing strategic, high-uncertainty architectural choices, technology evaluations, or open-ended ideation. This technique uses multi-perspective sampling to crush single-model hallucinations and isolate genuine trade-offs.

---

## 1. Complexity Gate (Anti-Overkill Rule)

> [!CAUTION]
> **Never Over-Engineer Simple Tasks**:
> - **DO NOT** trigger Stochastic Consensus for routine coding, minor bug fixes, styling adjustments, or straightforward feature additions.
> - **DO** trigger Stochastic Consensus **ONLY** for:
>   1. Strategic architectural crossroads (e.g. choice of database, auth framework, state architecture).
>   2. High-risk system trade-offs with conflicting constraints (e.g. latency vs. consistency).
>   3. Explicit user requests for ideation or brainstorming.

---

## 2. The Multi-Perspective Consensus Map

```
                  STRATEGIC PROBLEM
                          │
                          ▼
            [SPAWN 3-5 DIVERSE PERSPECTIVES]
     (Minimalist, Scalability Architect, Security Auditor, Pragmatist)
                          │
                          ▼
              [COUNT AGREEMENT & REASONING]
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
7-10 / 10 Agree     4-6 / 10 Agree     1-2 / 10 Agree
(High Confidence)   (Genuine Trade-off) (Wild Card / Novel)
       │                  │                  │
  [CONSENSUS]       [DIVERGENCE]         [OUTLIER]
  (Safe Bets)       (Judgment Call)     (Investigate)
       │                  │                  │
Auto-Approved       Presented to YOU     Small Experiment
in Action Plan      to Decide Choice     or Discarded
       │                  │                  │
       └──────────────────┼──────────────────┘
                          ▼
         RECORD AS ADR IN docs/decisions/
```

---

## 3. Step-by-Step Consensus Protocol

### Step 1: Formulate the Decision Prompt
Define the exact architectural question, system constraints, and non-functional requirements (performance, cost, team velocity).

### Step 2: Sample Diverse Personas (3 to 5 Perspectives)
Run sampling across distinct engineering perspectives:
1. **The Minimalist**: "What is the simplest, lowest-dependency solution?"
2. **The Scalability Architect**: "What solution handles 10x growth and high concurrency best?"
3. **The Security & Reliability Specialist**: "Where are the failure modes, attack surfaces, and data risks?"
4. **The DX / Pragmatist**: "What gives the fastest developer feedback loop and best maintainability?"

### Step 3: Build the Consensus Map Table
Synthesize findings into three clear categories:

| Category | Idea / Pattern | Perspective Support | Action |
| --- | --- | :---: | --- |
| **Consensus (Safe Bets)** | e.g. "Use PostgreSQL with connection pooling" | 4/4 agree | **Auto-Approved**: Added directly to plan. |
| **Divergence (Trade-offs)** | e.g. "Prisma ORM vs. Drizzle ORM" | 2/4 vs 2/4 | **Presented to User**: Clear pros/cons for decision. |
| **Outlier (Wild Cards)** | e.g. "Use custom in-memory SQLite sync" | 1/4 agree | **Flagged**: Evaluated as creative or discarded. |

### Step 4: Present Trade-offs to User & Record ADR
1. Summarize the Safe Bets and present only the 1-2 Divergent choices that genuinely require human judgment.
2. Record the final agreed outcome as an Architecture Decision Record (`docs/decisions/NNN-<decision>.md`).
