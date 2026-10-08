# Palpay Rail

## One-line pitch

**Palpay Rail gives every AI agent a permission slip before it can spend.** A person defines what a payment is for, who it can go to, how much it can cost, and when that permission expires. The agent can prepare a PayPal payment, but the rail checks the request against that permission before any money moves.

## The problem

People are beginning to delegate purchases and business tasks to AI agents, but a general spending limit is not enough to make delegation feel safe. An agent can stay under budget and still buy the wrong thing: a recurring subscription instead of a one-time tool, a service from an unapproved vendor, or an item unrelated to the task it was given.

The missing control is **purpose-bound permission**: a clear link between the user's intent and the exact payment the agent is trying to make.

## The idea

A user creates a **Spend Mission**, for example:

> Find a one-time video transcription service for this project. Use an approved vendor, spend no more than $25, and do not start a subscription. Ask me before paying if anything does not match.

Palpay Rail turns that request into a reviewable permission envelope. A deterministic policy check evaluates each proposed payment against that envelope. The AI can help interpret the user's words and explain a decision, but it cannot override the rules or move money by itself.

Each attempt ends in one of three clear states:

- **Allowed:** the payment matches the mission and limits.
- **Needs approval:** the request is plausible but crosses a user-defined boundary. The user reviews the details and explicitly approves or rejects it.
- **Blocked:** the request violates a hard rule, such as the wrong vendor, a subscription, an expired mission, or an exceeded limit.

## What makes it different

This is not another AI shopping assistant and not a generic monthly budget dashboard. The product is a **transaction-level permission layer** that checks whether a specific payment matches the user's stated purpose.

The key demo contrast: two requests can have the same price, but only one is permitted. A $19 one-time purchase for the approved task passes; a $19 recurring subscription is stopped because the mission disallows subscriptions.

## Demo workflow

1. The manager creates a mission in the Flutter app using plain language.
2. The app shows the AI-generated policy as editable fields: purpose, permitted vendor/category, maximum amount, one-time vs. recurring, expiry, and approval conditions.
3. A simulated agent submits a purchase request with its vendor, item, amount, and payment type.
4. Palpay Rail records the decision and shows the exact rules that matched or failed.
5. For an approval-required request, the manager receives a push notification and reviews the purchase on the phone.
6. After explicit approval, the backend creates or completes the corresponding PayPal sandbox order and records its result in the audit feed.
7. The demo repeats with a subscription or wrong-vendor request and shows it blocked before payment.

The video should show the full path: mission creation, a permitted or approval-required purchase, the mobile approval, a PayPal sandbox result, and a blocked near-miss. Use only sandbox accounts and make the demo data obviously fictional.

## Product surface

### Flutter mobile app

- Create and edit Spend Missions.
- Review the structured rules generated from natural language.
- Receive push alerts for approval requests.
- Inspect the proposed purchase, the mission, and the reason for the decision.
- Approve or reject requests that are eligible for human review.
- View a chronological audit feed of allowed, escalated, and blocked attempts.

### Backend service

- Accept signed or authenticated payment intents from the demo agent.
- Validate input and evaluate hard policy rules deterministically.
- Store missions, requests, decisions, approvals, and PayPal sandbox references.
- Create and capture PayPal sandbox orders only at the appropriate, explicitly approved step.
- Emit a push notification for approval-required requests.
- Keep credentials and PayPal API calls server-side.

## AI and policy safety

- Use an LLM to convert natural-language instructions into a **draft** structured policy and to explain decisions in plain language.
- Require the user to review and confirm the policy before it becomes active.
- Evaluate payment requests with ordinary code, not an LLM judgment call.
- Treat vendor, amount, recurrence, expiry, currency, and mission-purpose constraints as explicit fields.
- Fail closed when required details are missing or ambiguous; ask the user instead of silently approving.
- Require a human action for escalations. Do not claim the prototype provides escrow, buyer protection, or unattended payment authorization.

## PayPal integration

PayPal is the payment rail, not a decorative checkout button. The prototype should use the PayPal sandbox Orders API for a real end-to-end test payment, with server-side order creation and capture after the required approval step. The audit entry should retain the sandbox order ID and resulting status.

Before implementation, verify the current PayPal Agent Toolkit/MCP capabilities and hackathon sandbox constraints. Do not claim that a toolkit can enforce policies or execute a particular payment operation until that flow has been tested. If the toolkit does not support the needed sandbox flow, use the documented PayPal Orders API directly and explain the choice in the submission.

## Suggested implementation

- **Mobile client:** Flutter.
- **API and policy service:** Node.js with TypeScript and Express.
- **Payment:** PayPal Orders API in sandbox; secrets remain on the server.
- **Persistence and live updates:** Supabase, if it accelerates implementation; otherwise use the smallest reliable store needed for the demo.
- **Push:** Firebase Cloud Messaging for native Flutter builds.
- **Hosting:** Render for the API and any hosted web/demo surface required by the submission.
- **Demo agent:** a small scripted client that submits both valid and invalid payment intents, so the presentation is deterministic and repeatable.

## MVP boundary

Build one polished manager workflow and one reliable end-to-end payment path:

- Create one mission from natural language and confirm its structured rules.
- Submit a valid request and a deliberate policy violation.
- Show allow, escalate, and block decisions with understandable explanations.
- Deliver one native push notification for an escalation.
- Complete one approved PayPal sandbox order.
- Show the event history in the Flutter app.

Do not build a general-purpose agent marketplace, real-money custody, escrow, multi-company administration, complex vendor integrations, or a second dashboard product for the hackathon MVP.

## Why it could stand out

- **Technological implementation:** the policy decision changes whether a real PayPal sandbox order can proceed.
- **Design:** the permission envelope and decision explanation make a technical control understandable on a phone.
- **Impact:** it addresses the specific gap between an agent being able to pay and a user being comfortable delegating a purchase.
- **Innovation:** permission is tied to the purpose and terms of one task, not just a broad spend ceiling.
- **Presentation:** the same-price/different-permission contrast makes the safety behavior easy to see in a short video.

These are positioning hypotheses, not a prediction of judging results. Before committing, scan the project gallery and discussions for overlapping ideas and sharpen the target user or workflow if similar entries are common.

## Submission readiness

- Public source repository with an open-source license.
- Complete setup instructions and sandbox configuration steps; never commit secrets.
- Hosted demo or clear local run instructions that let judges use a working build.
- Public YouTube demo video under three minutes, showing the running product and its PayPal sandbox interaction.
- English project description that clearly labels sandbox transactions and explains what is implemented versus simulated.
- List the actual tools used and what each one does.

## Short project description draft

**Palpay Rail is a mobile control layer for AI-initiated payments.** Users give an agent a purpose-bound spending mission, such as buying a one-time service from an approved vendor under a fixed limit. Palpay Rail turns that instruction into reviewable rules, checks each payment request deterministically, blocks mismatches, and sends edge cases to the user for approval. Approved demo payments complete through PayPal's sandbox, with every decision recorded in an audit feed. The AI helps express and explain policy; the user remains in control of the rules and approvals.
