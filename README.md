# ProcurePilot

A **conversational AI procurement agent for small businesses** — an entry to the
**PayPal AI Hackathon** (submissions close **November 12, 2026**), built solo by
**Solana Minter** (Purple Castle Ventures).

The business owner states a need in plain language ("restock breakroom coffee
pods, under $50, fast shipping"). ProcurePilot:

1. **Discovers** matching products across merchants (Channel3 catalog API)
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
`MOCK_MODE` is enabled (the default); real HTTP adapters slot into the marked
extension points in later weeks without changing any caller code.

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

**Today (Week 1 scaffold): everything runs on mocks — zero network calls, zero
credentials.**

| Piece | Status |
|---|---|
| Channel3 product search | **Mock** — in-memory catalog: 15 products across 4 categories (packaging, office, cleaning, breakroom), 5–6 fictional-merchant offers each, ~150ms artificial latency |
| PayPal order create/capture/get | **Mock** — in-memory order store, sandbox-shaped responses (`MOCK-…` order IDs, `sandbox.paypal.com` approval URLs), ~200ms artificial latency |
| LLM / chat UI | **Working against mocks** — full chat UI (chat, comparison cards, tap-to-approve, order status) streams the orchestrator (`/api/chat`: intent → search → compare → proposal); intent parsing and summaries use a deterministic mock when `MOCK_MODE=true`, real LLM via `generateObject`/`streamText` once keys land |
| Evals | **Working** — `npm run eval`: 5 canned intents, all passing (intent parsing, brute-force comparison check, PayPal round-trip) |

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
- [ ] **Channel3 API key** — sign up at **<https://trychannel3.com>**
      (verified Oct 6, 2026). New accounts get **1,000 free searches**, no credit
      card required; paid tiers start at $7 per 1,000 queries. The key goes in
      the `x-api-key` header for `https://api.trychannel3.com/v1/search`.
      Docs: <https://docs.trychannel3.com>.
- [ ] **LLM key** — any OpenAI-compatible API key works. Set
      `LLM_BASE_URL` (e.g. `https://api.openai.com/v1`) and `LLM_MODEL`
      (e.g. `gpt-4o-mini`), or point `LLM_BASE_URL` at any compatible endpoint
      (together.ai, OpenRouter, vLLM, Ollama, …).

> **Standing rule:** credentials are supplied by the user, used transiently, and
> never committed. `.env.local` is gitignored.

## Project phases

- **Week 1 (this scaffold):** contracts + mocks + placeholder page
- **Week 2:** chat UI (Vercel AI SDK), comparison engine, approval flow
- **Week 3:** real PayPal sandbox + real Channel3, order dashboard, demo video

## License

MIT — Solana Minter / Purple Castle Ventures. See `LICENSE`.
