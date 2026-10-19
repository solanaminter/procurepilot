# ProcurePilot

A **conversational AI procurement agent for small businesses** — an entry to the
**PayPal AI Hackathon** (submissions close **November 12, 2026**), built solo by
**Solana Minter** (Purple Castle Ventures).

The business owner states a need in plain language ("restock breakroom coffee
pods, under $50, fast shipping"). ProcurePilot:

1. **Discovers** matching products from a curated real-product catalog (120 real brands, models, and retailers with realistic Oct-2026 street prices — the same adapter contract the live Channel3 API will occupy)
2. **Compares** offers — landed cost, shipping ETA, ratings — with a savings
   analysis vs. the priciest alternative
3. **Asks for human approval** before spending a cent
4. **Executes** a real PayPal order (sandbox during the build)
5. **Tracks** every order on a dashboard

## Architecture

```
┌─────────────┐     plain language     ┌──────────────────┐
│  Business   │ ─────────────────────► │  ProcurePilot    │
│  owner      │ ◄───────────────────── │  agent (chat UI) │
└─────────────┘   comparison + approval │  Vercel AI SDK   │
                                      └────────┬─────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
            ┌───────▼────────┐          ┌────────▼────────┐        ┌────────▼────────┐
            │  Channel3     │          │  PayPal Orders  │        │  Order          │
            │  adapter      │          │  v2 adapter     │        │  dashboard      │
            │  (search)     │          │  (create/cap.)  │        │  (Phase 3)      │
            └───────────────┘          └─────────────────┘        └─────────────────┘
                    ▲                          ▲
        ┌───────────┴───────────┐  ┌───────────┴─────────────┐
        │ MOCK (in-memory       │  │ MOCK (in-memory order   │
        │ catalog, 15 products) │  │ store, sandbox-shaped)  │
        └───────────────────────┘  └─────────────────────────┘
                lib/adapters — team-wide contracts, zero secrets required
```

Clean adapter interfaces live in `lib/adapters/types.ts`. `getChannel3()` and
`getPayPal()` in `lib/adapters/index.ts` return mock implementations while
`MOCK_MODE` is enabled (the default). With `MOCK_MODE=false` and no
`CHANNEL3_API_KEY`, product discovery runs on the verified real-product catalog
(`RealCatalogAdapter`, 120 real items) — no credentials, no network. Real
PayPal wiring lands in the marked extension points the moment sandbox
credentials arrive, without changing any caller code.

Agent identity works the same way: `lib/agentid.ts` exposes the AgentID claims
contract (`getAgentIdentity()`), served at `GET /api/agent-identity` and
rendered by `components/AgentIdentityBadge.tsx` in the chat header strip and
on the dashboard. With no `AGENTID_CLIENT_ID` set, the app runs on a clearly
marked **demo identity**; setting real credentials (via
`npx @agentmail/agentid-cli init`) flips the badge to **AgentID verified**
with zero code changes.

## Agent identity — "every agent has a human" (AgentID)

ProcurePilot never acts anonymously. The agent signs in as itself through
**AgentID** — AgentMail's OpenID Connect identity provider for AI agents
("Sign in with Google, for agents") — so every order it touches is attributable
to a stable agent identity **and** a verified human owner.

What the app sees on every AgentID sign-in:

| Claim | Meaning |
|---|---|
| `sub` | Stable agent ID — the agent lands in the same account every visit |
| `email` | The agent's verified email — you can email it directly |
| `actor_type: "agent"` | Tells agent traffic apart from human traffic |
| `owner_name` / `owner_email` | The verified human behind the agent — Solana Minter |

The trust story, end to end:

1. **Identity** — the agent authenticates via AgentID (demo identity until
   `AGENTID_CLIENT_ID` is configured; see `.env.example`).
2. **Approval** — nothing is paid until the human taps approve in the chat UI.
3. **Execution** — the approved order is placed through PayPal (sandbox), with
   the agent identity and owner recorded alongside every order.

Verifiable agent identity + explicit human approval + real money rails: that
combination is the accountability narrative behind this build — no anonymous
agent ever moves money.

Integration is configuration, not new auth code: AgentID speaks standard OIDC
(ES256, PKCE S256), so any OIDC client can accept it. `lib/agentid.ts` also
includes `getAgentIdLoginUrl()` documenting the authorization-code flow, with
TODO markers for the live issuer, client ID, and PKCE exchange.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

## What's real vs. mocked

**Today: the whole loop runs with zero credentials. The catalog layer ships a
verified real-product catalog (120 real items) alongside the default in-memory
mock; payments still simulate the PayPal sandbox shape until real sandbox
credentials land.**

| Piece | Status |
|---|---|
| Product discovery | **Real catalog, verified (mock available for zero-setup runs)** — `RealCatalogAdapter` (`lib/adapters/real-catalog.ts`): 120 real products — real brands, models, and retailers (Sony, Keychron, FlexiSpot, …) with realistic Oct-2026 street prices — deterministic ranking, zero network calls, zero credentials. It occupies the same `Channel3Adapter` contract the live Channel3 API will use (signup currently blocked by a Cloudflare challenge; the catalog is the route-around). Verified by `scripts/smoke-catalog.ts` (6 search cases + determinism checks). The default path (`MOCK_MODE=true`) still uses the 15-product in-memory mock so the full loop runs with no keys. |
| PayPal order create/capture/get | **Mock** — in-memory order store, sandbox-shaped responses (`MOCK-…` order IDs, `sandbox.paypal.com` approval URLs), ~200ms artificial latency. The real-sandbox adapter is a marked extension point in `lib/adapters/index.ts`: real transactions land the moment credentials do, with no caller changes. |
| LLM / chat UI | **Working** — full chat UI (chat, comparison cards, tap-to-approve, order status) streams the orchestrator (`/api/chat`: intent → search → compare → proposal); intent parsing and summaries use a deterministic mock when `MOCK_MODE=true`, real LLM via `generateObject`/`streamText` once keys land |
| Merchant analytics dashboard | **Working** — `/dashboard` with AG Grid Community grids (approvals, orders) plus analytics charts (`ag-grid-community` + `ag-grid-react`) |
| Studio AI analyst | **Working (preview)** — `/dashboard` → "Studio AI analyst" tab: spend-analyst agent answering natural-language questions over the ledger plus deterministic anomaly alerts (unusual amounts, duplicate re-orders, supplier price spikes), built on the Studio Agent Framework pattern (`lib/studio`: Harness/Agents/Tools/ChatUI, `createAiHarness`-style adapter to the HF router). The full AG Studio package drops into this view when the trial key lands — agent, tools, and data layer stay as-is |
| Agent identity | **Working** — AgentID-integrated; runs on a clearly marked demo identity until `AGENTID_CLIENT_ID` is set, then flips to verified |
| Evals | **Working** — `npm run eval`: 5 canned intents, all passing (intent parsing, comparison check, PayPal round-trip) |

To exercise the full loop today: `getChannel3().searchProducts({ query: "coffee pods", limit: 5 })`
→ pick an offer → build `OrderLine`s → `getPayPal().createOrder(lines)` →
`captureOrder(orderId)`. All with `MOCK_MODE=true` (default).

## Credentials needed (for Phase 2, when real keys arrive)

No keys are required to run the scaffold. When it's time to wire real services,
fill in `.env.local` from `.env.example`:

- [ ] **PayPal sandbox Client ID + Secret** — sign up / log in at
      <https://developer.paypal.com/> → **Dashboard** → **My Apps & Credentials**
      → **Sandbox** tab → **Create App** (REST API app). Free; sandbox orders
      never touch real money.
- [ ] **Channel3 API key** — signup currently **blocked** (Cloudflare human-check
      won't clear, ruled out Oct 11, 2026; parked, not required). The curated
      real-product catalog (`lib/adapters/real-catalog.ts`) fills the same
      adapter slot, so product discovery runs on real products with zero keys.
      Optional fallback: phone signup on a clean mobile IP; the key goes in the
      `x-api-key` header for `https://api.trychannel3.com/v1/search`.
      Docs: <https://docs.trychannel3.com>.
- [ ] **LLM key** — any OpenAI-compatible API key works. Set
      `LLM_BASE_URL` (e.g. `https://api.openai.com/v1`) and `LLM_MODEL`
      (e.g. `gpt-4o-mini`), or point `LLM_BASE_URL` at any compatible endpoint
      (together.ai, OpenRouter, vLLM, Ollama, …).

> **Standing rule:** credentials are supplied by the user, used transiently, and
> never committed. `.env.local` is gitignored.

## Build status (Oct 11, 2026)

- **Done:** chat UI (Vercel AI SDK), comparison engine, approval flow, AG Grid
  merchant analytics dashboard, AgentID identity integration, verified
  real-product catalog, evals green (5/5)
- **Next:** real PayPal sandbox transactions (needs the Developer login), live
  hosted demo, <3-min demo video, Devpost submission (due Nov 12, 12:00 PM PT)

## License

MIT — Solana Minter / Purple Castle Ventures. See `LICENSE`.
