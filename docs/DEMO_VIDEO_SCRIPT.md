# ProcurePilot — Demo Video Script (draft)

**Target:** < 3:00 total (narration ~390 words @ ~150 wpm ≈ 2:36 + transitions)
**Narration engine:** Kokoro, default voice (free path per standing rule; HeyGen Marcia is the accepted alternate)
**Record against:** local `npm run dev` (localhost:3000) — swap in the hosted Vercel URL once deployed; no re-script needed
**Required by the rules:** show the project functioning on the device it was built for; upload to public YouTube; link in README + submission form. No third-party copyrighted music.

**Prize framing baked in:** 1st Place ($12K) + ONE sponsor prize — Best Use of AG Grid ($5K) = $17K ceiling (Devpost stacking rule: max one Grand + one Sponsor). Don't name-drop other sponsor prizes in narration; it reads naive to judges who know the rule. Say "agentic procurement on PayPal rails, AG Grid for the merchant analytics dashboard" — it matches AG Grid's prize description verbatim.

---

## 0:00–0:20 — HOOK (motion-graphics cold open)

**Visual:** Kinetic typography over dark grid. "Small businesses lose 4+ hours a week to restocking." → cut to: "AI agents can buy things now. Who do you trust with the company card?"

**Narration (70 words):**
> Small businesses lose hours every week to restocking — comparing listings, checking shipping, chasing approvals. AI agents can finally do that shopping for them. But an agent that spends real money needs more than a demo — it needs accountability. Meet ProcurePilot: a conversational procurement agent that discovers real products, compares real prices, asks a human before spending a cent, pays on PayPal rails, and proves who it is with verifiable agent identity. Watch it work.

**Lower third:** "ProcurePilot — conversational procurement on PayPal rails · PayPal AI Hackathon"

---

## 0:20–1:50 — WALKTHROUGH (real demo, screen capture)

### 0:20–0:45 — The ask
**Visual:** Chat UI. Type: `restock breakroom coffee pods, under $50, fast shipping`. Message sends; typing indicator.

**Narration (55 words):**
> The owner just types what they need, in plain language. No SKU hunting, no tabs. ProcurePilot's orchestrator parses the intent — product, budget cap, shipping constraint — and searches a catalog of one hundred twenty real products: real brands, real retailers, real October street prices, ranked deterministically.

**Motion graphic:** intent tokens pop out of the sentence ("coffee pods", "< $50", "fast shipping") → animate into a search beam.

### 0:45–1:10 — Comparison
**Visual:** Comparison cards appear: landed cost, shipping ETA, ratings, and a savings callout vs. the priciest alternative.

**Narration (50 words):**
> It returns a head-to-head comparison — landed cost, shipping time, ratings — and shows exactly how much you save versus the priciest option. This is the moment most agents skip straight to checkout. ProcurePilot doesn't. Nothing moves until the human taps approve.

**Motion graphic:** savings figure counts up ("You save $X.XX vs. priciest").

### 1:10–1:30 — Approval gate + PayPal execution
**Visual:** Big Approve / Reject buttons. Tap Approve → order status animates: `creating → capturing → complete`, order ID appears, sandbox approval link visible.

**Narration (55 words):**
> One tap. The approved order executes through the PayPal Orders API — create, capture, done — with the agent's identity and its human owner recorded on every order. That's the accountability story: verifiable identity, explicit human approval, real money rails. No anonymous agent ever moves money.

**Motion graphic:** shield/checkmark lockup: "AgentID verified → human approved → PayPal captured".

### 1:30–1:50 — Merchant dashboard (AG Grid line)
**Visual:** `/dashboard` — AG Grid Community tables (approvals, orders) + analytics charts. Scroll a grid, sort a column.

**Narration (45 words):**
> And every order lands on the merchant analytics dashboard — AG Grid tables for approvals and orders, with spend analytics on top. The finance team gets the same transparency the owner got in chat.

**Lower third:** "Best Use of AG Grid · ag-grid-community + ag-grid-react"

---

## 1:50–2:25 — ARCHITECTURE (motion-graphics diagram)

**Visual:** Animated diagram — chat UI → Vercel AI SDK orchestrator → three adapter lanes (Channel3 catalog adapter · PayPal Orders v2 adapter · AgentID claims contract) → AG Grid dashboard. Adapters pulse; a "mock ↔ real" toggle flips on the PayPal lane.

**Narration (75 words):**
> Under the hood it's clean adapter architecture. The chat UI talks to an orchestrator built on the Vercel AI SDK. Product discovery runs through a catalog adapter — today a verified real-product catalog, same contract the live Channel3 API will occupy. Payments go through a PayPal Orders adapter, sandbox-shaped today, real transactions the moment sandbox credentials land — no caller changes. Identity is an AgentID claims contract: stable agent ID, verified human owner. And the dashboard is AG Grid, end to end.

**On-screen labels:** `lib/adapters/types.ts` · `/api/chat` · `/api/agent-identity` · `/dashboard`

---

## 2:25–2:40 — CLOSE

**Visual:** Logo lockup. "ProcurePilot — every agent has a human." Repo URL + demo URL cards.

**Narration (40 words):**
> ProcurePilot: discover, compare, approve, pay, track — agentic commerce you can audit. Built solo by Solana Minter for the PayPal AI Hackathon. Every agent has a human.

**End card:** github.com/solanaminter/procurepilot · demo URL (swap in hosted URL when live)

---

## Production notes

- **Screen capture:** 1920×1080, cursor visible, 60fps. Use the coffee-pods intent verbatim (it's the README's canonical example and exercises budget + shipping constraints).
- **Order IDs** will read `MOCK-…` until sandbox wiring lands — frame verbally as "sandbox-shaped" (matches README's real-vs-mocked section); re-record only the 1:10–1:30 beat after the PayPal login lands if time allows.
- **TTS:** single Kokoro pass of the narration blocks; align cuts to the timestamps above.
- **What NOT to include:** the Channel3 Cloudflare saga, Bedrock, or any other hackathon — this video is the PayPal story only.
- **Deliverables:** public YouTube upload → link in README "Live Demo / Demo Video" section + Devpost submission form (Presentation criterion: video must show end-to-end function — this script does).
