# Palpay Rail

**A permission layer for AI agent payments.** An agent can propose a purchase; a
deterministic policy engine — not an LLM — decides whether PayPal is ever called.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

- **Live API:** https://palpay-rail-api.onrender.com
- **New here?** [HOW-IT-WORKS.md](./HOW-IT-WORKS.md) explains the whole project in
  plain English, no coding background needed.
- **Full product spec:** [Palpay-Rail.md](./Palpay-Rail.md)

## How it works

1. A manager describes a **Spend Mission** in plain language (purpose, approved
   vendors, per-payment cap, total budget, one-time vs. recurring, expiry).
2. Gemini drafts a structured policy from that text. It is only a *draft* — the
   manager reviews, edits, and confirms before it becomes active.
3. An AI agent proposes a purchase. Palpay Rail's deterministic policy engine
   evaluates it and returns **Allowed**, **Needs Approval**, or **Blocked**.
4. **Allowed** completes a real PayPal sandbox order immediately, zero clicks.
   **Needs Approval** pushes to the manager's phone and waits for a tap.
   **Blocked** never contacts PayPal at all.
5. Gemini explains each decision in plain English — *after* the decision is final.
6. Every attempt lands in an audit feed with matched/failed rules and order IDs.

**The contrast that proves it works:** a $19 one-time purchase is paid
automatically, while a $19/month subscription from the same vendor for the same
amount is blocked outright. Same price, different permission.

## What the policy engine enforces

| Rule | Outcome if violated |
|---|---|
| `mission_active` | Blocked — mission is cancelled or still a draft |
| `mission_not_expired` | Blocked — past the mission's expiry |
| `vendor_allowed` | Blocked — vendor not on the approved list |
| `recurring_allowed` | Blocked — subscription attempted when only one-time is allowed |
| `currency_match` | Blocked — currency differs from the mission |
| `within_max_amount` | Blocked — exceeds the per-payment cap |
| `within_mission_budget` | Blocked — would exceed the mission's **cumulative** budget |
| `valid_request_fields` | Escalated — details incomplete or ambiguous (fails closed) |
| `below_near_limit_threshold` | Escalated — close to the cap, manager opted into review |

Two design decisions worth calling out:

- **The AI never decides.** `evaluateRequest()` is pure, deterministic, and
  LLM-free, so the same mission + request always produces the same outcome. You
  cannot prompt your way around a rule, because no prompt is involved.
- **Policy is re-checked immediately before every payment**, not just when the
  request is raised. If a mission is cancelled, expires, or has its budget
  consumed while a request sits pending, approving it is refused rather than paid.

## Repo structure

```
server/     Node.js + TypeScript + Express API: policy engine, PayPal, approvals, push, audit
agent/      Demo agent: Gemini function-calling client whose only tool is Palpay Rail's
mobile/     Flutter app (Android): mission creation, budgets, audit feed, push-to-approve
supabase/   SQL migrations
```

## Prerequisites

- Node.js 20+
- Flutter 3.x with the Android toolchain
- A [PayPal Developer](https://developer.paypal.com/) sandbox app (client ID + secret)
- A [Supabase](https://supabase.com/) project
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (free tier)
- A [Firebase](https://console.firebase.google.com/) project with Cloud Messaging
  (optional — push degrades gracefully if absent)

## Setup

### 1. Database

Run the migrations in `supabase/migrations/` **in order** against your Supabase
project (SQL editor or `supabase db push`):

```
0001_init.sql                  -- core schema
0002_mission_total_budget.sql  -- cumulative spend cap
```

### 2. Server

```
cd server
cp .env.example .env   # fill in real values
npm install
npm run dev
```

Health check: `GET http://localhost:4000/health`

### 3. Demo agent

```
cd agent
cp .env.example .env   # AGENT_API_KEY must match server/.env
npm install
npm start -- <missionId> <scenario>
```

Scenarios demonstrate each policy outcome. The agent is given exactly one tool,
`submit_purchase_request` — it holds no PayPal credentials and cannot move money:

| Scenario | What the agent tries | Expected outcome |
|---|---|---|
| `compliant` | Cheapest valid one-time purchase | Allowed, paid automatically |
| `subscription` | An auto-renewing monthly plan | Blocked |
| `rogue-vendor` | A cheaper but unapproved vendor | Blocked |
| `overspend` | A bulk pack over the cap | Blocked |

### 4. Mobile app

```
cd mobile
flutter pub get
flutter run -d android
```

On first launch, enter your server URL (defaults to the live Render API) and the
manager API key from `server/.env`.

**Push notifications (optional):** create an Android app in your Firebase project
with package name `com.palpayrail.mobile`, download `google-services.json`, and
place it at `mobile/android/app/google-services.json`. Without it the build still
succeeds and approvals arrive via in-app polling instead.

## Deploy the API (optional)

The repo includes a `render.yaml` Blueprint for [Render](https://render.com/):

1. Push the repo to GitHub.
2. On Render: **New > Blueprint**, connect the repo.
3. Set every variable marked `sync: false` to the same values as `server/.env`.
4. Deploy and note the URL.

Render's free tier sleeps when idle, so the first request after a while takes
~30-60s to cold-start. Warm it with a health check before recording a demo.

If Render's dashboard mangles the multi-line `FIREBASE_PRIVATE_KEY`, paste a
base64-encoded version of the whole PEM instead — the server detects and decodes
either format.

## Security

- **Secrets stay server-side.** The mobile app holds only a manager API key it was
  given; PayPal, Gemini, Supabase, and Firebase credentials never leave the server.
- **Bearer auth on every money-touching endpoint**, compared with
  `timingSafeEqual` to avoid leaking the key through response timing.
- **Separate agent and manager keys** — an agent can propose purchases but cannot
  approve them.
- **Input validation with zod** at every HTTP boundary.
- **Idempotent PayPal calls** via `PayPal-Request-Id`, plus a database-level
  `WHERE approval_status = 'pending'` guard so a request can never be paid twice.
- **Rate limiting** on LLM-calling endpoints to bound cost and abuse.
- **Fails closed** — ambiguous or incomplete requests escalate to a human rather
  than defaulting to allow.
- `@paypal/agent-toolkit` was evaluated and deliberately **not** used: its current
  release bundles `@langchain/core`/`langsmith` versions with unpatched
  high-severity advisories (including GHSA-r399-636x-v7f6, a deserialization bug
  enabling secret extraction). The server calls PayPal's REST API directly instead.

## Known limitations

Stated plainly, because they bound what this prototype proves:

- **Request details are self-reported by the agent.** The rail governs what an
  agent *declares* (vendor, amount, recurrence) and builds the PayPal order from
  those same values, so it cannot be charged more than it declared through this
  rail — but nothing independently verifies the declaration against an external
  merchant.
- **Vendor-to-payee routing is configurable but off by default.** Set
  `PAYPAL_VENDOR_PAYEES` to map approved vendors to real sandbox merchant accounts.
  Unset (as in the demo), all orders go to the app's own sandbox merchant, so the
  vendor allowlist gates *whether* a payment happens, not *who receives it*.
- **Rate limiting is in-memory**, so it resets on restart and is not shared across
  instances. A production deployment would use a shared store.
- **Single-tenant by design.** One manager, one agent key, no multi-user accounts.
- **Mission status does not auto-expire** on a schedule; expiry is enforced by a
  timestamp check at decision time, which is equivalent in effect.
- **Sandbox only.** Every payment uses PayPal's sandbox and fake test money.

## Tests

```
npm run test:server
```

Covers the policy engine (every rule, including cumulative budget exhaustion and
the one-time-vs-subscription contrast) and the PayPal client (idempotency keys,
token caching, error handling, payee routing).

## Tools used

| Tool | Role |
|---|---|
| PayPal Orders API (sandbox) | Real order creation and capture |
| Google Gemini (`@google/genai`) | Drafts policies from natural language; explains decisions; powers the demo agent's tool-calling |
| Supabase (Postgres) | Missions, requests, decisions, audit history |
| Firebase Cloud Messaging | Push notifications for approvals |
| Flutter | Android manager app |
| Node.js + TypeScript + Express | Policy engine and API |
| Render | API hosting |
| Vitest | Unit tests |

## License

MIT — see [LICENSE](./LICENSE).
