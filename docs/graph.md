# Project Dependency & Relationship Graph

This document provides the structural wiring diagram for **StandupPulse**. It maps component hierarchies, API route call paths, database schemas, and blast-radius dependencies to enable safe refactoring and architectural analysis.

---

## 1. System Context & Component Graph

```mermaid
graph TD
    User([Team Member]) <-->|Google Chat 1:1 DM| GChatAPI[Google Chat API / Gateway]
    Admin([Leadership / Admin]) <-->|Browser / Dashboard| Dashboard[Next.js Client View<br/>app/page.tsx]
    VercelCron([Vercel Cron Service]) -->|Scheduled GET 05:00/05:45 UTC| TriggerRoute[API Trigger Route<br/>app/api/trigger-bot/route.ts]

    subgraph Presentation & Routing Layer [Next.js App Router]
        ChatRoute[Webhook Receiver<br/>app/api/chat/google/route.ts]
        TriggerRoute
        EmpRoute[Employee CRUD<br/>app/api/employees/route.ts]
        SettingsRoute[Settings API<br/>app/api/settings/route.ts]
        StandupsRoute[Standups API<br/>app/api/standups/route.ts]
        Dashboard
    end

    subgraph Service & Engine Layer [Core Business Logic]
        DirectEngine[Direct DM Engine<br/>lib/googleChatDirect.ts]
        NLPParser[Intelligent NLP Parser<br/>lib/parser.ts]
        CardHelper[CardsV2 Card Builder<br/>lib/googleChatHelper.ts]
    end

    subgraph Persistence Layer [Universal Storage Adapter]
        DBAdapter[Database Adapter<br/>lib/db.ts]
        MemoryCache[(In-Memory Cache)]
        LocalJSON[(JSON Seed Files<br/>data/*.json)]
        TmpStore[(Serverless /tmp Files)]
        RedisKV[(Vercel KV / Redis)]
    end

    GChatAPI -->|POST Inbound Event| ChatRoute
    TriggerRoute --> DirectEngine
    Dashboard -->|HTTP Fetch / Polling| StandupsRoute
    Dashboard -->|HTTP Fetch / Polling| EmpRoute
    Dashboard -->|Trigger Actions| TriggerRoute
    Dashboard -->|Save Config| SettingsRoute

    ChatRoute --> NLPParser
    ChatRoute --> CardHelper
    ChatRoute --> DBAdapter
    DirectEngine --> CardHelper
    DirectEngine --> DBAdapter
    DirectEngine -->|POST Outbound Message / RSA-256 JWT| GChatAPI

    StandupsRoute --> DBAdapter
    EmpRoute --> DBAdapter
    SettingsRoute --> DBAdapter

    DBAdapter --> MemoryCache
    DBAdapter --> LocalJSON
    DBAdapter --> TmpStore
    DBAdapter --> RedisKV
```

---

## 2. API Route & Call Flow Graph

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Engineering Lead
    participant Dash as Executive Dashboard (app/page.tsx)
    participant Trigger as API /api/trigger-bot
    participant Direct as lib/googleChatDirect.ts
    participant Google as Google Chat API
    actor Emp as Team Member
    participant Webhook as API /api/chat/google
    participant Parser as lib/parser.ts
    participant DB as lib/db.ts

    Note over Admin,Google: Morning Check-in Broadcast (10:30 AM IST)
    Admin->>Dash: Clicks "Send Bot" (or Vercel Cron fires)
    Dash->>Trigger: POST /api/trigger-bot?action=trigger
    Trigger->>Direct: broadcastDirectStandup(isNudge=false)
    Direct->>Google: OAuth2 JWT Token Request
    Google-->>Direct: Access Token
    Direct->>Google: Discover 1:1 Spaces & dispatch CardsV2 prompt
    Google->>Emp: Proactive Standup Card in 1:1 DM

    Note over Emp,DB: Conversational Response & Draft Resolution
    Emp->>Google: Replies: "Project Alpha for 6 hrs, available 2 hrs"
    Google->>Webhook: POST Event (MESSAGE)
    Webhook->>Parser: parseStandupMessage(text)
    Parser-->>Webhook: Parsed: { project: "Project Alpha", hours: 6, blocker: "Available for tasks (2 hrs)" }
    Webhook->>DB: saveStandup(record)
    Webhook->>DB: clearPendingDraft(email)
    Webhook-->>Google: CardsV2 Confirmation Card
    Google->>Emp: Displays "Standup Logged: 6h (2h available flagged)"

    Note over Dash,DB: Real-Time Executive Visibility
    Dash->>DB: GET /api/standups
    DB-->>Dash: Updated standup records
    Dash->>Admin: Live responses, attendance gauge & project breakdown updated
```

---

## 3. Database Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    EMPLOYEE ||--o{ STANDUP_RECORD : submits
    COMPANY_SETTINGS ||--o{ EMPLOYEE : configures
    STANDUP_RECORD }o--|| PROJECT_GROUP : aggregated_into

    EMPLOYEE {
        string id PK
        string name
        string email UK
        string dept
        string role
        string webhookUrl "1:1 Google Chat Space ID"
        string createdAt
        string lastStandupDate
        string lastStandupTime
        json pendingDraft "Multi-turn conversational draft"
    }

    STANDUP_RECORD {
        string id PK
        string employeeId FK
        string name
        string email
        string dept
        string tasks "Normalized task summary"
        string[] taskList "Itemized task badges"
        float hours "Total hours logged"
        string project "Normalized project names"
        string blocker "Blockers or Available hours alert"
        string date "YYYY-MM-DD (Asia/Kolkata)"
        string time "HH:MM:SS"
        string source "google_chat | web | import"
        string rawText "Original message text"
    }

    COMPANY_SETTINGS {
        string companyName
        string standupTime "e.g. 10:30"
        string standupStartTime
        string standupEndTime
        boolean autoNudgeEnabled
        int nudgeIntervalMinutes "e.g. 45"
        int maxNudges
        string googleChatWebhookUrl
        string googleServiceAccountKey "GCP RSA-256 Key JSON"
        string botPrompt "Prompt template"
        string gifTag
        string theme "dark | light"
    }

    PROJECT_GROUP {
        string projectName PK
        float totalHours
        int blockerCount
        json members
    }
```

---

## 4. Blast Radius & Dependency Matrix

Use this table to check downstream impacts before modifying shared core modules:

| Core Module / File | Direct Dependents (Imported By) | Risk Level | Blast Radius Mitigation & Safeguards |
| :--- | :--- | :---: | :--- |
| `lib/types.ts` | All API routes, `lib/db.ts`, `lib/parser.ts`, `app/page.tsx` | **CRITICAL** | Run full TypeScript verification. Schema changes must account for legacy stored JSON. |
| `lib/db.ts` | All API routes (`/api/chat/google`, `/api/employees`, `/api/standups`, `/api/settings`, `/api/trigger-bot`) | **HIGH** | Test in-memory cache, file IO fallback, and draft state handling. Ensure atomic record overwrites for same-day standups. |
| `lib/parser.ts` | `app/api/chat/google/route.ts` | **HIGH** | Verify multi-project splitting, decimal hours (`30 mins` -> `0.5h`), available hours -> blocker conversion, and leave detection. |
| `lib/googleChatDirect.ts` | `app/api/trigger-bot/route.ts`, `app/api/chat/google/route.ts` | **HIGH** | Test RSA-256 JWT assertion, 30-minute anti-spam guard, and strict 12:00 PM noon cutoff logic. |
| `lib/googleChatHelper.ts` | `lib/googleChatDirect.ts`, `app/api/chat/google/route.ts` | **MEDIUM** | Validate Google CardsV2 JSON schema compatibility. Ensure button action payloads are valid JSON. |
| `app/api/chat/google/route.ts` | Google Chat Webhook infrastructure | **HIGH** | Verify handling of `MESSAGE`, `CARD_CLICKED`, `ADDED_TO_SPACE`, and `REMOVED_FROM_SPACE` events. |
| `app/page.tsx` | End-user leadership web dashboard | **MEDIUM** | Verify responsive rendering, table/grid view toggling, date filters (`Today` vs `All History`), and manual trigger buttons. |
| `.githooks/pre-commit` | Git CLI / Developer workflow | **HIGH** | Ensure pattern regex does not flag false positives on legitimate source code while blocking `.env` and private keys. |
