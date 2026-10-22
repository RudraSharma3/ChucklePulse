# Socratic Requirements Clarifier Playbook

Follow this playbook when the user presents a broad, ambitious, or open-ended project or feature idea. Instead of rushing into blind implementation, the agent conducts a concise, 4-question architectural interview to eliminate ambiguity.

---

## 1. When to Trigger

- User says: *"I want to build an Uber for pets"* or *"Let's build a SaaS platform for accountants."*
- User runs slash command: `/interview <idea>`
- The project idea has multiple viable business or architectural directions.

---

## 2. The 4 Essential Focus Areas

The agent must ask **no more than 3–4 high-impact questions** covering:

1. **Target Users & Core Problem**:
   - Who is the primary persona using this application daily?
   - What is the single non-negotiable workflow they must complete?
2. **Data & State Model**:
   - What are the 2–3 core entities (e.g. Users, Teams, Documents, Invoices) and how do they relate?
3. **Authentication & Security Boundary**:
   - Is it public, invite-only, or multi-tenant (team-based)?
   - Any compliance constraints (GDPR, HIPAA, payment processing)?
4. **Technical Preferences & External Integrations**:
   - Any required third-party APIs (Stripe, Twilio, OpenAI, AWS S3)?
   - Preferred database / hosting stack if not using defaults.

---

## 3. Interview Protocol Rules

1. **Multiple Choice When Possible**: Format questions with clear selectable options (A, B, C) and recommended defaults to make answering quick for the user.
2. **Never Overwhelm**: Never ask a wall of 15 questions at once.
3. **Immediate Synthesis**: Once answered, immediately populate `docs/architecture.md` and `docs/task-state.md` with the finalized decisions.
