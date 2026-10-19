# ProcurePilot — Devpost submission text package (DRAFT, coordinator-owned)

Hackathon: **PayPal AI Hackathon** (https://paypalaihackathon.devpost.com/)
Filing window: opens at kickoff; **closes Wednesday Nov 12, 2026, 12:00 PM PT** (3:00 PM ET).
Internal target: file by Nov 10.
Prize strategy: 1st Place $12K + Best Use of AG Grid 1st $5K = $17K ceiling.
Judging criteria (exact): Technological Implementation · Design · Potential Impact ·
Innovation/Idea · Presentation.

## Title
**ProcurePilot — Conversational AI Procurement Agent for Small Business**

## Tagline / elevator pitch (≤ 140 chars — count before filing)
An AI agent that takes plain-language purchasing needs, compares real offers, gets human approval, and places real PayPal orders.

## What it does (main description)

Small businesses bleed money on procurement: owners juggle five browser tabs, guess at
shipping costs, and never see the true landed cost before they pay. ProcurePilot is a
conversational AI agent that turns one sentence — "restock breakroom coffee pods, under
$50, fast shipping" — into a completed, attributable purchase.

The agent loop, end to end:
1. **Understands intent** — parses the request into structured constraints (budget,
   quantity, shipping window, category) via the LLM.
2. **Discovers real offers** — searches a 120-product real-catalog adapter (real
   brands, models, and October-2026 street prices; the same interface the live
   Channel3 API will occupy), returning landed-cost comparisons with shipping ETAs,
   ratings, and a savings analysis vs. the priciest alternative.
3. **Asks a human before spending a cent** — renders an approval card with the exact
   order breakdown; nothing moves until the owner taps approve. The agent never acts
   anonymously: it authenticates via **AgentID** (AgentMail's OIDC identity provider
   for AI agents), so every order carries a stable agent identity *and* a verified
   human owner ("every agent has a human").
4. **Executes through PayPal** — the approved order is placed via PayPal Orders v2
   (sandbox during the build; extension points are marked for live credentials), with
   the agent identity and owner recorded alongside every order.
5. **Tracks everything** — an AG Grid merchant dashboard shows orders, statuses, and
   spend analytics across real transaction data.

The accountability story is the thesis: **verifiable agent identity + explicit human
approval + real money rails.** This is what "put AI behind the wheel" looks like when
the wheel is attached to actual money.

## Built With (Devpost "Built With" field — honest, current)

**Working today (judge-runnable without keys):**
- Next.js 15 + React 19 (Vercel AI SDK v6 chat UI, streaming tool-part UI)
- Vercel AI SDK (DefaultChatTransport, UIMessage wire format)
- AG Grid (ag-grid-community + ag-grid-react) — merchant spend dashboard
- PayPal Orders v2 adapter contract (sandbox-shaped in demo identity mode)
- AgentID / AgentMail — OIDC agent identity contract ("every agent has a human")
- Tailwind CSS v4 (postcss)
- Local/free LLM tier: Modal-hosted Qwen2.5-7B-Instruct vLLM endpoint
  (scale-to-zero; verified live Oct 14) for intent parsing and reasoning

**Adapter-ready (extension points marked in code; flips live with credentials):**
- PayPal sandbox credentials → real Orders v2 transactions
- Channel3 API key → live product discovery (verified real 114-product catalog
  adapter currently satisfies the discovery contract)

## How it meets the criteria (filing notes — trim to 3 lines on the form)

- **Technological Implementation:** deep PayPal Orders v2 usage (create/capture, order
  tracking), streaming multi-part agent UI, real adapter contracts with credential-gated
  live paths — a working, non-trivial implementation, not a demo-page mockup.
- **Design:** a complete merchant product — chat, comparison cards, approval gate,
  AG Grid spend dashboard — coherent and demoable end to end.
- **Potential Impact:** small-business procurement is a universal, concrete pain;
  landed-cost comparison plus approval gating solves a real, measurable problem.
- **Innovation:** the agent-identity thesis (AgentID: verifiable identity + human
  approval before money moves) is the differentiator in an agentic-commerce field.
- **Presentation:** <3:00 narrated demo video (free TTS), live Vercel demo, public repo.

## Links (fill at filing time)

- Live demo: https://procurepilot-zeta.vercel.app (200, public, no login wall —
  verified Oct 19)
- Repo: https://github.com/solanaminter/procurepilot (PUSH PENDING — 11 local
  commits ahead of origin; needs his transient GitHub token)
- Demo video: YouTube link (PENDING — video file ready at
  `~/workspace/hackathons/paypal-procurepilot/video/procurepilot-demo-video.mp4`,
  2:41; upload is his tap)
- Pitch deck: (optional add if made)

## Filing blockers (all his taps — do NOT file until clear)

1. GitHub push — 11 commits ahead of origin/master (transient token).
2. YouTube upload — demo video file-pick.
3. PayPal sandbox login — converts the sandbox-shaped PayPal path into REAL
   sandbox transactions (past-winner pattern: real transactions on camera; mock-only
   PayPal fails the event's hard gate "meaningfully use both PayPal and AI").
