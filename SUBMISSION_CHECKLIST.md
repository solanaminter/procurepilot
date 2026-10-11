# ProcurePilot — PayPal AI Hackathon submission checklist

**Hard deadline: Wednesday Nov 12, 2026, 12:00 PM PT** (3:00 PM ET per the
official Devpost page, verified Oct 11). Internal submit target: **Nov 10**.

Prize strategy (verified Oct 11 on the official page): 1st Place $12K +
Best Use of AG Grid 1st $5K = $17K ceiling. Judging criteria: Technological
Implementation, Design, Potential Impact, Innovation/Idea, Presentation.

## Official requirements (from paypalaihackathon.devpost.com) — status

- [x] Project meaningfully uses PayPal + AI — agent loop: intent → search →
      compare → human approval → PayPal order (Orders v2)
- [x] Working prototype — chat UI + comparison cards + approval gate + dashboard,
      build green and evals 5/5 (verified Oct 11)
- [ ] **Functional demo the judges can run** — needs EITHER a hosted demo URL
      (blocked: Vercel CLI token expired; needs his `vercel login`) OR complete
      setup/run instructions (repo has README; mock mode runs with zero keys)
- [ ] **Public code repo (GitHub) with visible LICENSE** — LICENSE (MIT) in
      repo; repo NOT yet on GitHub (blocked: his GitHub token, transient use)
- [ ] **Demo video < 3 min, public YouTube** — not yet produced (Phase 3;
      standing rule: walkthrough + architecture, free TTS only — Kokoro default)
- [ ] Text description + tools used and how — README covers; submission text
      draft still to write
- [ ] Sponsor-prize eligibility: AG Grid dashboard uses ag-grid-community +
      ag-grid-react (merchant analytics); APIMatic Context Plugin play drafted

## Credential gates (all his taps)

1. **PayPal Developer login** (sandbox app) — sandbox wiring is code-ready the
   second it lands; past-winner pattern needs REAL sandbox transactions, never
   mocked. Capture card re-issued Oct 10; still outstanding.
2. **GitHub token** (transient, never stored) — to publish the public repo.
3. **Vercel CLI re-login** — to deploy the live demo (new deployments need the
   SSO Deployment Protection check per AGENTS.md lesson).

## Non-blocking

- Channel3: routed around with the verified real 114-product catalog adapter
  (build green, evals pass). Optional phone signup if he wants the real API.
- LLM key: any OpenAI-compatible key; mock intent parsing covers judges'
  local run without keys.

## Week ahead

- Mon Oct 12, 7:00–7:45 AM PT — AG Grid webinar (Teams, via Devpost login);
  Sylwia Vargas (AG Grid judge) confirmed on the judges list.
- Tue Oct 13, 1:00–2:00 AM PT — repeat "Start building with PayPal" webinar
  (1 AM — not attendable; Oct 6 recording already exists).
