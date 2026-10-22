# Token Optimization, Context Architecture & Model Routing Playbook

This playbook defines the context efficiency, token compression defense, and cost-reduction architecture implemented across the AI Operating System.

---

## 🏔️ 1. The Iceberg Context Technique

AI models perform best with lean, focused context. AI-OS divides all repository information using the **10/90 Iceberg Model**:

```
                       ▲
                      / \
                     /   \
  ABOVE WATER       / 10% \    IN IMMEDIATE CONTEXT:
  (Always Hot)     /       \   • AGENTS.md & Provider Adapters
  ─────────────────────────────────────────────────────────────────
  BELOW WATER      \       /   ACCESSIBLE ON-DEMAND VIA TOOLS:
  (On-Demand)       \ 90% /    • Full Codebase (via Grep / Glob)
                     \   /     • Specific File Slices (via Targeted Read)
                      \ /      • Skills & Playbooks Library (Auto-Matched)
                       ▼       • Git History & Deep Test Traces
```

### The Golden Rule:
> **Only surface what matters NOW.** Never dump full 10,000-line files or all playbooks into the prompt at once.

---

## ⚡ 2. Naive vs. Strategic Context Loading

| Dimension | ❌ Naive Approach (What amateurs do) | ✅ Strategic AI-OS Approach (How senior devs build) |
|---|---|---|
| **Codebase Ingestion** | Dumps entire codebase into prompt (Context overflow). | Uses targeted `grep` and reads only relevant function slices. |
| **Playbooks & Skills** | Inlines all 13 playbooks into system prompt (~25k tokens). | Keeps base `AGENTS.md` lean (<1k tokens); loads playbooks on-demand. |
| **Tool Results** | Stores massive raw logs (10,000 lines of build output). | Summarizes tool results into actionable diffs and error traces. |
| **Result** | **Frequent context crashes, amnesia, high token costs.** | **3x–5x more effective, low latency, room to work.** |

---

## 🗜️ 3. Context Compression Defense (Disk-First Persistence)

When an AI conversation reaches ~80% context window capacity, AI systems trigger **Auto-Compaction** (compressing the chat history from ~50K tokens to ~15K tokens).

```
  FRESH CONVERSATION ──▶ AUTO-COMPACT TRIGGERED ──▶ COMPRESSION ──▶ COMPRESSED CONTEXT
  (50K tokens, full)     (80% full, pressure)      (LLM drops tool  (~15K tokens, loss
                                                    outputs & logs)  of exact errors)
```

### ⚠️ What Gets Lost During Compaction:
Exact compiler error messages, nuanced architectural reasoning, and intermediate step progress.

### 🛡️ The AI-OS Solution (Checkpoint Before Compaction):
AI-OS enforces **Disk-First Persistence**:
1. **Never keep state in memory only**: Immediately write all milestones, architectural findings, and task checklists to `docs/task-state.md` and `docs/architecture.md`.
2. When compaction triggers, the AI reads the disk files and resumes with **zero information loss**!

---

## 🎯 4. Model Routing: The 60 / 30 / 10 Rule

To slash token costs by **70–80%** without sacrificing code quality, AI-OS structures agent tasks into 3 tiers:

```
                          ┌──▶ 60% HAIKU / FLASH ($0.50–$1 / 1M tokens)
                          │    Triage, classification, pre-commit scans, yes/no checks
                          │
  AGENT ROUTER ───────────┼──▶ 30% SONNET / GPT-4o ($3 / 1M tokens)
  (Complexity Gate)       │    Code generation, feature implementation, refactoring
                          │
                          └──▶ 10% OPUS / O1 / THINKING ($5–$15 / 1M tokens)
                               Strategic system architecture, consensus ADRs, audits
```

### Allocation Breakdown:
1. **60% Tasks (Fast & Cost-Efficient)**:
   - Git pre-commit secret scanning (`.githooks/pre-commit`)
   - Health doctor diagnostics (`scripts/doctor.ps1`)
   - Simple file lookups, test execution, and triage
2. **30% Tasks (Core Workhorse)**:
   - 1-Implementer code generation (`playbooks/feature.md`)
   - Autonomous bug-fixing & test writing (`playbooks/bug-fix.md`)
3. **10% Tasks (Heavyweight Reasoning)**:
   - Strategic Stochastic Consensus (`playbooks/stochastic-consensus.md`)
   - Architecture Decision Records (`docs/decisions/`)
   - Threat modeling & multi-agent orchestrations

---

## 🚀 5. Prompt Caching (Prefix Stability)

Modern LLM providers (Anthropic, Gemini, OpenAI) offer **server-side prompt caching**:

- **Pinned Prefix (Top of Context - 100% Cached)**:
  - Canonical Operating Rules (`AGENTS.md`)
  - Team Conventions (`docs/conventions.md`)
  - Static Architecture Tokens (`docs/architecture.md`)
- **Dynamic Suffix (Bottom of Context - Changing)**:
  - Active task status (`docs/task-state.md`) and latest user prompt

> 💰 **Impact**: Cuts input token latency from **~8s to <2s** and slashes input token costs by **up to 90%**!
