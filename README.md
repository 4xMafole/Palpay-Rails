# Palpay Rail

Purpose-bound spending permission for AI agents, enforced before a PayPal payment moves.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

See [Palpay-Rail.md](./Palpay-Rail.md) for the full product spec.

## How it works

1. A manager creates a **Spend Mission** in plain language (purpose, approved vendors, max amount, one-time vs. recurring, expiry).
2. Gemini drafts a structured policy from that text; the manager reviews and confirms it before it goes active.
3. An AI agent submits a purchase request. Palpay Rail's deterministic policy engine — not an LLM — evaluates it against the mission and returns **Allowed**, **Needs Approval**, or **Blocked**.
4. Allowed requests complete a real PayPal sandbox order automatically. Needs-Approval requests push a notification to the manager's phone; only after an explicit tap does the order get created and captured. Blocked requests never touch PayPal.
5. Every decision is recorded in an audit feed with the matched/failed rules and the resulting PayPal sandbox order ID.

## Repo structure

```
server/     Node.js + TypeScript + Express API: missions, policy engine, PayPal sandbox integration, approvals, push, audit
agent/      Demo agent: Gemini function-calling client that submits purchase requests to the server
mobile/     Flutter app (Android): mission creation, audit feed, push-to-approve
supabase/   SQL migrations for the Postgres schema
```

## Prerequisites

- Node.js 20+
- Flutter 3.x with the Android toolchain
- A [PayPal Developer](https://developer.paypal.com/) sandbox app (client ID + secret)
- A [Supabase](https://supabase.com/) project
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (free tier) for Gemini
- A [Firebase](https://console.firebase.google.com/) project with Cloud Messaging enabled, and a service account key

## Setup

### 1. Database

Run the SQL in `supabase/migrations/0001_init.sql` against your Supabase project (SQL editor or `supabase db push`).

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
cp .env.example .env   # fill in real values, AGENT_API_KEY must match server/.env
npm install
npm start
```

### 4. Mobile app

```
cd mobile
flutter pub get
flutter run -d android
```

On first launch, the app shows a Connect screen — enter your server URL (use `http://10.0.2.2:4000` for an Android emulator hitting a local server, or your Render URL) and the manager API key.

**Push notifications (optional):** the app works fully without this — approvals still show up via in-app polling. To enable real push, create an Android app in your Firebase project (package name `com.palpayrail.mobile`), download `google-services.json`, and place it at `mobile/android/app/google-services.json`. If that file isn't present, the build still succeeds and push registration just no-ops silently.

## Deploy the API (optional)

Judges can also just run the server locally (see above) — hosting is not required, but it lets anyone hit a live API without configuring Supabase/PayPal/Gemini/Firebase themselves first.

The repo includes a `render.yaml` Blueprint for [Render](https://render.com/):

1. Push this repo to GitHub (it already needs to be public for submission).
2. On Render: **New > Blueprint**, connect the repo. It detects `render.yaml` and creates a `palpay-rail-api` web service.
3. In the service's **Environment** tab, set every variable marked `sync: false` to the **same values** you used in `server/.env` (Supabase, PayPal, Gemini, Firebase, `AGENT_API_KEY`, `MANAGER_API_KEY`).
4. Deploy. Note the resulting URL (e.g. `https://palpay-rail-api.onrender.com`).
5. Point the demo agent (`agent/.env` → `PALPAY_RAIL_API_URL`) and the mobile app's Connect screen at that URL instead of `localhost`.

Render's free tier spins down idle services — the first request after a while sleeping takes ~30-60s to cold-start. If you're recording the demo video, either hit the health check first to warm it up, or demo against `localhost` to avoid the wait.

## Status

This repo is under active development for the hackathon submission window. See commit history for progress against the build plan.

## License

MIT — see [LICENSE](./LICENSE).
