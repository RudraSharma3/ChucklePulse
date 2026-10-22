# Project Conventions

This document establishes coding standards, style preferences, git workflows, architectural patterns, and testing guidelines for **StandupPulse**.

---

## 1. Code Style & Formatting

### 1.1 Language & Framework Conventions
- **Language**: TypeScript 5.6+ with strict type checking enabled (`tsconfig.json`).
- **Framework**: Next.js 14 App Router (`app/` directory).
  - API Routes: Located in `app/api/<feature>/route.ts`. Use standard Web API `Request` and `NextResponse`.
  - Frontend: Server-side root layout (`app/layout.tsx`) and client-side reactive components with `'use client'` directive.
- **Styling**: Tailwind CSS with custom utility classes in `app/globals.css`. Do not introduce ad-hoc CSS frameworks.
- **Iconography**: Lucide React (`lucide-react`) for consistent vector icons.

### 1.2 Module Organization & Typing
- Public interfaces, domain models, and API schemas must reside in [`lib/types.ts`](file:///c:/Users/HP/OneDrive/Desktop/Greeting/lib/types.ts).
- Helper functions must have explicit parameter and return type signatures. Avoid `any` except where external Google Chat payloads require runtime polymorphism.
- Core business logic must remain decoupled from HTTP routing:
  - Text parsing logic goes into [`lib/parser.ts`](file:///c:/Users/HP/OneDrive/Desktop/Greeting/lib/parser.ts).
  - Google Chat API interactions go into [`lib/googleChatDirect.ts`](file:///c:/Users/HP/OneDrive/Desktop/Greeting/lib/googleChatDirect.ts).
  - CardsV2 UI structures go into [`lib/googleChatHelper.ts`](file:///c:/Users/HP/OneDrive/Desktop/Greeting/lib/googleChatHelper.ts).
  - Persistence queries and mutations go into [`lib/db.ts`](file:///c:/Users/HP/OneDrive/Desktop/Greeting/lib/db.ts).

---

## 2. Standup Domain & Timezone Conventions

### 2.1 Shift Expectations & Capacity Rules
- **8-Hour Shift Standard**: Team members work an 8-hour shift. If an initial standup submission accounts for fewer than 8 hours, the system maintains a `pendingDraft` and issues a clarification card for the deficit.
- **Available Hours as Blockers**: Any time reported as available, free, bench, or standby (e.g., `"available = 1.5 hrs"`, `"2h free"`) must be recorded in the `blocker` field as `Available for tasks (<N> hrs)` so engineering leadership can assign unallocated capacity.
- **Fractional Minutes**: Time inputs in minutes (e.g. `30 mins`, `30m`) must convert to precise two-decimal hours (`0.5`), rather than rounding to whole integers.

### 2.2 Timezone & Schedule Rules
- **Timezone**: All application date formatting, cutoffs, and cron jobs reference Indian Standard Time (`Asia/Kolkata`, UTC+5:30).
- **Proactive Prompts**: Dispatched at 10:30 AM IST (05:00 UTC).
- **Follow-up Nudges**: Dispatched at 11:15 AM IST (05:45 UTC).
- **Strict 12:00 PM Noon Cutoff**: Follow-up nudges are strictly forbidden after 12:00 PM local time. If an employee has not responded by 12:00 PM, no further proactive notifications are sent for the remainder of the day.

---

## 3. Git & Version Control

- **Commit Format**: Follow Conventional Commits: `<type>(<scope>): <short imperative summary>`
  - Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
  - Examples:
    - `feat(parser): add support for available hours as blocker warnings`
    - `fix(direct): enforce 12:00 PM cutoff on standup follow-up nudges`
    - `docs(arch): update component wiring and sequence flow`
- **Git Secret Guard**:
  - The repository enforces pre-commit scanning via `.githooks/pre-commit`.
  - Never stage or commit `.env`, private keys, GCP service account JSON files, or live API credentials.
  - Test fixtures containing synthetic tokens must be registered in `.ai/secret-allowlist.txt`.

---

## 4. Error Handling & Logging

- **Resilience First**: Network or external API calls (e.g. Google Chat API, OAuth token endpoint) must be wrapped in `try/catch` blocks.
- **Graceful Fallbacks**: If Google Cloud Service Account credentials are missing or expired, API endpoints must return structured JSON error payloads with actionable troubleshooting hints instead of crashing.
- **Safe Persistence**: File system writes in `lib/db.ts` must catch read-only filesystem errors and gracefully fallback to `os.tmpdir()` in serverless environments.
- **Diagnostic Logging**: Prepend system logs with identifying tags:
  - `[StandupBot]` for chat interactions and scheduling.
  - `[GoogleDirect]` for OAuth2 JWT assertion and space discovery.
  - `[DB]` for multi-tier persistence events.

---

## 5. Testing & Verification

- **TypeScript Verification**: Check types using the local compiler (`node node_modules/typescript/lib/tsc.js --noEmit`).
- **Production Build**: Verify Next.js build integrity (`node node_modules/next/dist/bin/next build` or `npm run build`).
- **Regression Checklist for Core Changes**:
  1. Parse standard multi-project strings: `"Project A for 4h and Project B for 4h"`.
  2. Parse availability strings: `"Project A for 6h, available = 2h"`.
  3. Verify 30-minute conversion: `"30 mins"` -> `0.5` hours.
  4. Verify anti-spam guard: No employee prompted twice within 30 minutes.
  5. Verify noon cutoff: Nudges past 12:00 PM return `Follow-up window closed`.
