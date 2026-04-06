<div align="center">
  <img src="public/screenshots/dashboard.png" alt="GlomoRegWatch Dashboard" width="100%"/>
  <h1>🛡️ GlomoRegWatch</h1>
  <p><strong>AI-Powered Regulatory Intelligence for GIFT City</strong></p>

  <p>
    <a href="https://github.com/akdPM/GlomoRegWatch"><img src="https://img.shields.io/badge/GitHub-GlomoRegWatch-181717?logo=github" /></a>
    <img src="https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs" />
    <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase" />
    <img src="https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?logo=openai" />
    <img src="https://img.shields.io/badge/Deployed-Vercel-000000?logo=vercel" />
  </p>
</div>

---

## What is GlomoRegWatch?

GlomoRegWatch is a compliance automation tool built for **Glomopay**, an IFSC-licensed cross-border remittance company in GIFT City. It automatically:

- **Scrapes** RBI & IFSCA regulatory circulars daily
- **Analyses** them with GPT-4o-mini to extract impact, urgency, scope, and action items
- **Triages** them in a compliance dashboard with a 5-stage workflow
- **Creates Jira tickets** per action item, with individual assignee selection
- **Syncs Jira status** back to the dashboard in real-time
- **Alerts** your Slack team with threaded updates

---

## 📸 Screenshots

### Triage Dashboard
![Dashboard](public/screenshots/dashboard.png)

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Next.js 15 (App Router)               │
│                                                              │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │  /api/fetch │   │ /api/tickets │   │ /api/tickets/sync│  │
│  │  (Cron: 2AM)│   │   (Create)   │   │   (Cron: 4AM)    │  │
│  └──────┬──────┘   └──────┬───────┘   └──────────┬───────┘  │
│         │                 │                       │          │
└─────────┼─────────────────┼───────────────────────┼──────────┘
          │                 │                       │
    ┌─────▼──────┐   ┌──────▼──────┐        ┌──────▼──────┐
    │ RBI/IFSCA  │   │   Jira API  │        │   Jira API  │
    │  Scrapers  │   │  (Create)   │        │   (Poll)    │
    └─────┬──────┘   └─────────────┘        └─────────────┘
          │
    ┌─────▼──────┐
    │ OpenAI API │  ← GPT-4o-mini: summary, relevance, action items
    └─────┬──────┘
          │
    ┌─────▼──────┐
    │  Supabase  │  ← documents + action_items JSONB + activity_logs
    └─────┬──────┘
          │
    ┌─────▼──────┐
    │  Slack API │  ← Thread-based notifications per circular
    └────────────┘
```

### Status Workflow
```
📥 Fetched → 🔍 Analyzed → 👀 Under Review → 🚨 Action Required → ✅ Reviewed
```

---

## 🚀 Setup

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [OpenAI](https://platform.openai.com) API key
- A [Jira](https://www.atlassian.com/software/jira) project with API token
- A [Slack](https://slack.com) Bot token

### 1. Clone & Install

```bash
git clone https://github.com/akdPM/GlomoRegWatch.git
cd GlomoRegWatch
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

### 3. Set Up the Database

Run the SQL in **Supabase → SQL Editor**:

```bash
# Copy the contents of supabase_schema.sql and run it in the Supabase SQL editor
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔐 Environment Variables

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) | ✅ |
| `OPENAI_API_KEY` | OpenAI API key for AI analysis | ✅ |
| `JIRA_BASE_URL` | Your Jira instance URL (e.g. `https://yourco.atlassian.net`) | ✅ |
| `JIRA_EMAIL` | Jira account email | ✅ |
| `JIRA_API_TOKEN` | Jira API token ([generate here](https://id.atlassian.com/manage-profile/security/api-tokens)) | ✅ |
| `JIRA_PROJECT_KEY` | Jira project key (e.g. `SCRUM`) | ✅ |
| `JIRA_EPIC_KEY` | Epic to link all tickets to (e.g. `SCRUM-1`) | Optional |
| `SLACK_BOT_TOKEN` | Slack Bot OAuth token (`xoxb-...`) | Optional |
| `SLACK_CHANNEL` | Slack channel ID to post alerts | Optional |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL (legacy fallback) | Optional |

---

## 📋 Database Schema

Run `supabase_schema.sql` in your Supabase SQL Editor. Key tables:

| Table | Purpose |
|---|---|
| `documents` | Regulatory circulars with AI analysis and JSONB action items |
| `sync_logs` | History of each fetch/ingest run |
| `activity_logs` | Audit trail: who changed what status and when |

---

## ⚙️ Cron Jobs (Vercel)

Configured in `vercel.json`:

| Schedule | Endpoint | Purpose |
|---|---|---|
| Daily @ 2AM UTC | `/api/fetch` | Scrape + AI-analyse new circulars |
| Daily @ 3:30AM UTC | `/api/digest` | Send daily Slack digest |
| Daily @ 4AM UTC | `/api/tickets/sync` | Sync Jira ticket statuses |

> **Note:** Vercel Hobby plan supports daily crons only. Upgrade to Pro for sub-daily schedules.

---

## 🔬 Feature Deep Dive

---

### 1. 🌐 Regulatory Circular Scraper

**What it does:** Every day at 2AM, the system automatically visits the RBI and IFSCA websites, reads their "What's New" bulletin boards, and pulls in every new circular published since the last check.

Think of it like a bot that wakes up every morning, opens the RBI website, makes a list of all new PDFs published overnight, reads their full text, and saves them.

- Uses **web scraping** — the code reads raw HTML exactly like a browser would, but automatically
- For PDFs, it extracts raw text using a PDF parser so the AI can read it
- Only saves **brand new** circulars (deduplicated by unique source URL)
- On Vercel, processes 5 circulars per run to stay within serverless timeout limits

---

### 2. 🤖 AI Analysis + Relevance Scoring Formula

The system sends the raw circular text to **GPT-4o-mini** which responds in structured JSON:

| Field | What the AI generates |
|---|---|
| `summary` | 1–2 sentence plain English summary |
| `why_it_matters` | Tailored impact explanation for Glomopay |
| `evidence_excerpt` | Exact sentence(s) from the circular that triggered the flag |
| `action_items` | Tasks with owner, due date, and severity |

#### 📐 The Scoring Formula

Relevance is calculated by a **deterministic scoring engine** (`src/lib/scoring.ts`) — not guessed by AI:

```
Total Score = Impact + Urgency + Scope + Confidence  (max = 11)
```

| Total | Label |
|---|---|
| ≥ 9 | 🔴 High |
| 6–8 | 🟡 Medium |
| 3–5 | 🟢 Low |
| < 3 | ⚪ Not Relevant |

**Impact (0–3)** — keyword scan of the raw circular text:

| Keywords | Weight |
|---|---|
| `LRS`, `FATF`, `AML`, `KYC`, `SANCTIONS`, `REMITTANCE` | **3** |
| `PURPOSE CODE`, `TCS`, `REPORTING`, `CONSULTATION` | **2** |

**Urgency (0–3)** — regex pattern matching:

| Pattern matched | Score |
|---|---|
| "effective immediately", "shall comply forthwith" | **3** |
| "within N days", "by [Month Year]", "take effect on" | **2** |
| "consultation paper", "proposed", "draft" | **1** |

**Scope (0–3)** — based on AI-generated action items:

| Condition | Score |
|---|---|
| Action items span 2+ different owner teams | **3** — Cross-functional |
| All action items → 1 team | **2** — Single-function |

**Confidence (0–2)** — quality of evidence excerpt found:

| Condition | Score |
|---|---|
| Excerpt > 20 characters | **2** — Explicit |
| Short excerpt | **1** — Inferred |
| None found | **0** |

#### Worked Example

> *"RBI mandates outward remittance entities to update KYC processes within 30 days. Compliance and IT must act."*

| Dimension | Reason | Score |
|---|---|---|
| Impact | Contains "REMITTANCE" + "KYC" | **3** |
| Urgency | "within 30 days" matched | **2** |
| Scope | Compliance Team + IT Team = 2 unique owners | **3** |
| Confidence | 90-char evidence excerpt found | **2** |
| **Total** | 3+2+3+2 = 10 | **🔴 High** |

---

### 3. 🗄️ Database (Supabase / PostgreSQL)

| Table | Purpose |
|---|---|
| `documents` | Every circular — title, raw text, AI analysis, JSONB `action_items` (task + jira_key + assignee_name + status), compliance `status` |
| `activity_logs` | Audit trail row per status change — who changed what and when |
| `sync_logs` | Record of every scraper run — success/fail, count of new docs added |

The `action_items` column is a **JSONB array** — a list of objects stored inside a single database cell. Each object carries the full lifecycle of one task: from AI generation → Jira ticket creation → real-time sync → completion.

---

### 4. 📊 Compliance Triage Dashboard

- **Left panel** — scrollable list of all circulars, each showing source, relevance dot, status badge, date, and action item count
- **Right panel** — full AI analysis including 4-score breakdown, summary, "why it matters", evidence excerpt, and action items list
- **Top KPI cards** — Total circulars · High relevance · Unreviewed · **Actions Completed** (live `X / Y` with a filling progress bar across all Jira tickets)
- **Filters** — filter by Source, Relevance level, or Status

---

### 5. 🔁 5-Stage Compliance Workflow

Each circular moves through a colour-coded lifecycle via a dropdown selector:

```
📥 Fetched → 🔍 Analyzed → 👀 Under Review → 🚨 Action Required → ✅ Reviewed
```

Every state change is written to the **Activity Log** with a timestamp and actor name.

---

### 6. 🎫 Jira Ticket Creation with Assignment Modal

1. Click **"Create N Jira Tickets"** on any analyzed circular
2. An overlay modal opens — simultaneously fetches **real Jira users** from your project via `/api/jira/users`
3. Each action item gets its own assignee dropdown — mix and match across team members
4. Click **"Create Tickets"** → backend calls Jira REST API v3 to create each issue with:
   - Task description + severity as priority (`High`/`Medium`)
   - Assignee's Jira `accountId`
   - Labels: `glomoregwatch`, `compliance`, `regulatory`
   - Linked to the configured Epic
5. Jira ticket key + URL + assignee display name written back to the `action_items` JSONB in Supabase
6. Button locks into green **"N Active Jira Tickets"** badge — no accidental duplicates

---

### 7. 🔄 Jira Status Sync

Click **"Sync Jira"** or wait for the 4AM cron:

1. System fetches all documents that have Jira tickets
2. For each action item's `jira_key`, calls `GET /rest/api/3/issue/{key}` to get current status
3. Status string saved back into the JSONB array
4. UI re-renders:
   - `Done` → ✅ green checkmark, strikethrough text
   - `In Progress` → blue badge
   - `To Do` → grey badge
5. When **all** tickets for a circular are done → circular auto-promoted to `reviewed`
6. Top KPI "Actions Completed" counter updates

---

### 8. ⚠️ Overdue Detection

For each action item, the frontend runs:
```
isOverdue = today > due_date AND status NOT IN ['done', 'closed', 'resolved']
```
If true → quiet date badge upgrades to a pulsing red **"⚠ OVERDUE · date"** pill (CSS `animate-pulse`).

---

### 9. 📋 Activity Audit Log

Every status change writes to `activity_logs`:
```
actor: "Compliance Team"
action: "Status changed from 'analyzed' to 'under_review'"
created_at: 2026-04-07T01:45:00Z
```
Fetched via `/api/activity/[id]` when you select a circular. Renders as a chronological timeline feed in the detail pane — essential for regulated financial entity audits.

---

### 10. 🔔 Slack Notifications

- New high-relevance circular found → post rich message to Slack channel
- Slack `ts` (thread ID) saved to DB
- Circular marked "Reviewed" → thread reply posted: *"✅ Reviewed by compliance team"*

All discussion about a circular stays in one organised thread.

---

### 11. ⏱️ Automated Daily Cycle (Vercel Cron)

| Time (UTC) | Endpoint | What it does |
|---|---|---|
| 2:00 AM | `/api/fetch` | Scrape + AI-analyse new circulars, Slack alert |
| 3:30 AM | `/api/digest` | Daily morning digest to Slack |
| 4:00 AM | `/api/tickets/sync` | Poll Jira → update all ticket statuses |

By 9 AM IST, overnight circulars are already analysed and Jira is already synced — zero manual intervention needed.

---

### How It All Fits Together

```
Every day at 2AM
       │
       ▼
RBI/IFSCA websites scraped
       │
       ▼
New circulars → GPT-4o-mini
       │
       ▼
Relevance score + action items → Supabase
       │
       ├──► Slack alert for high-priority
       │
       ▼
Compliance officer opens dashboard
       │
       ├──► Reads AI summary & action items
       ├──► Changes status → Under Review  [Activity log entry written]
       ├──► Assignment Modal → picks team members per task
       ├──► Creates Jira tickets
       │
       ▼
Developer works in Jira
       │
       ▼
Auto-sync at 4AM (or manual Sync Jira)
       │
       ├──► Green checkmarks on done tasks
       ├──► KPI counter ticks up
       └──► All done → circular auto-promoted to Reviewed
                │
                └──► Slack thread: "✅ Reviewed by compliance team"
```

---

## 🌐 Deployed App

> [**https://glomoregwatch.vercel.app**](https://glomoregwatch.vercel.app) ← _Update with your Vercel URL_

---

## 🏢 Built For

**Glomopay** — IFSC-licensed cross-border remittance company, GIFT City, India.  
Monitors: RBI · IFSCA · SEBI · FATF

---

<div align="center">
  <sub>Built with Next.js 15 · Supabase · OpenAI · Jira · Slack · Vercel</sub>
</div>
