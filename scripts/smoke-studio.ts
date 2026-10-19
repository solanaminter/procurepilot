// ProcurePilot — Studio layer smoke test.
// Usage: npx tsx scripts/smoke-studio.ts
// Exit code: 0 when every check passes, 1 otherwise.
//
// Deterministic checks (detectors, tools, harness loop) always run.
// The live-LLM check requires the configured endpoint (STUDIO_LLM_BASE_URL /
// STUDIO_LLM_MODEL — the Modal-hosted vLLM endpoint; HF router is the
// documented fallback): chatWithHf must return a real answer plus a working
// tool-call round trip. The full agent loop is also verified end-to-end with
// a scripted ChatFn standing in for the model (same pattern as SarafuPay's
// scripted-LLM e2e test), plus a dead-model check for graceful degradation.

import { getLedgerOrders } from "../lib/ledger";
import { detectAnomalies } from "../lib/studio/anomalies";
import { SPEND_AGENT_TOOLS } from "../lib/studio/tools";
import { createAiHarness } from "../lib/studio/types";
import { runAgentTurn } from "../lib/studio/harness";
import { chatWithHf } from "../lib/studio/hfChat";
import { spendAgent } from "../lib/studio/spendAgent";
import type { ChatFn, StudioToolDef } from "../lib/studio/types";

let failures = 0;

function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("ProcurePilot Studio smoke test");

  // ── 1. Anomaly detectors on seeded data ──────────────────────────────
  console.log("\n[detectors]");
  const anomalies = detectAnomalies();
  const kinds = new Set(anomalies.map((a) => a.kind));
  check("detects the seeded duplicate order", kinds.has("duplicate_order"),
    `kinds: ${[...kinds].join(",")}`);
  check("detects the seeded price spike", kinds.has("price_spike"));
  check("detects the seeded unusual amount", kinds.has("unusual_amount"));
  check("found ≥3 anomalies total", anomalies.length >= 3, `got ${anomalies.length}`);
  for (const a of anomalies) {
    console.log(`    - [${a.severity}/${a.kind}] ${a.title}`);
  }
  const normal = getLedgerOrders().find((o) => o.orderId === "MOCK-7KX2P9Q4RA");
  check(
    "normal order MOCK-7KX2P9Q4RA is not flagged",
    normal !== undefined && !anomalies.some((a) => a.orderId === normal.orderId),
  );
  // Determinism: same ledger -> same output.
  const again = detectAnomalies();
  check(
    "detectors are deterministic",
    JSON.stringify(anomalies.map((a) => a.id)) === JSON.stringify(again.map((a) => a.id)),
  );

  // ── 2. Domain tools ─────────────────────────────────────────────────
  console.log("\n[tools]");
  const byName = new Map<string, StudioToolDef>(SPEND_AGENT_TOOLS.map((t) => [t.name, t]));
  check("8 tools registered", SPEND_AGENT_TOOLS.length === 8, `got ${SPEND_AGENT_TOOLS.length}`);

  const summary = (await byName.get("spend_summary")!.execute({})) as {
    orderCount: number; pendingApprovals: number;
  };
  check("spend_summary sees 16 seeded orders", summary.orderCount === 16, `got ${summary.orderCount}`);
  check("spend_summary sees 1 pending approval", summary.pendingApprovals === 1,
    `got ${summary.pendingApprovals}`);

  const anoms = (await byName.get("get_anomalies")!.execute({})) as { count: number };
  check("get_anomalies tool matches detectors", anoms.count === anomalies.length);

  const hist = (await byName.get("price_history")!.execute({ product: "toner" })) as {
    driftPct: string; purchases: { unitPrice: string }[];
  };
  check("price_history finds toner purchases", hist.purchases.length >= 2,
    `got ${hist.purchases.length}`);
  check("price_history shows the spike drift", hist.driftPct.startsWith("17."),
    `got ${hist.driftPct}`);

  const cats = (await byName.get("spend_by_category")!.execute({})) as unknown[];
  check("spend_by_category returns buckets", cats.length > 0);

  // ── 3. Real LLM adapter: live answers via the configured endpoint ─────
  // STUDIO_LLM_BASE_URL / STUDIO_LLM_MODEL point at the Modal-hosted vLLM
  // endpoint (HF router kept as documented fallback). The adapter still
  // degrades gracefully on provider errors — see the dead-model check below.
  console.log("\n[live llm]");
  const live = await chatWithHf({
    messages: [{ role: "user", content: [{ type: "text", text: "Reply with exactly: LIVE-OK" }] }],
    tools: [],
  });
  check("chatWithHf returns no error", !live.error, `error: ${live.error ?? "(none)"}`);
  check("chatWithHf returns a live answer", live.text.length > 0,
    `text: ${live.text.slice(0, 80)}`);
  console.log(`    answer: ${live.text.slice(0, 120)}`);

  // Tool-calling round trip — the harness's actual usage pattern.
  const liveTools = await chatWithHf({
    messages: [{
      role: "user",
      content: [{ type: "text", text: "Use the spend_summary tool to report how many orders exist." }],
    }],
    tools: SPEND_AGENT_TOOLS.filter((t) => t.name === "spend_summary"),
  });
  check("live tool-call round trip: no error", !liveTools.error,
    `error: ${liveTools.error ?? "(none)"}`);
  check("live tool-call round trip: model called spend_summary",
    liveTools.toolCalls.some((c) => c.name === "spend_summary"),
    `calls: ${liveTools.toolCalls.map((c) => c.name).join(",") || "(none)"}; ` +
    `text: ${liveTools.text.slice(0, 60)}`);

  // ── 4. Agent loop end-to-end with a scripted model ────────────────────
  console.log("\n[agent loop — scripted model]");
  const scripted: ChatFn = async (req) => {
    const last = req.messages[req.messages.length - 1];
    const sawToolResult = last.role === "tool";
    if (!sawToolResult) {
      return { text: "", toolCalls: [{ id: "call-1", name: "get_anomalies", input: {} }] };
    }
    const toolMsg = last.content.find((p) => p.type === "tool-result");
    const raw = toolMsg && toolMsg.type === "tool-result" ? toolMsg.output : "{}";
    let count = 0;
    let kindsFound = "";
    try {
      const parsed = JSON.parse(raw) as { count: number; anomalies: { kind: string }[] };
      count = parsed.count;
      kindsFound = [...new Set(parsed.anomalies.map((a) => a.kind))].join(", ");
    } catch { /* keep defaults */ }
    return {
      text:
        `I found ${count} anomalies in the order stream (${kindsFound}). ` +
        `The toner order MOCK-8SPK2W5TYN is both unusually large and shows a supplier price spike — ` +
        `I'd hold it for review before it ships.`,
      toolCalls: [],
    };
  };
  const harness = createAiHarness(scripted);
  const result = await runAgentTurn(harness, spendAgent, "Anything unusual in the order stream?");
  check("agent used exactly 2 steps", result.stepsUsed === 2, `got ${result.stepsUsed}`);
  check("agent trace shows the get_anomalies call",
    result.trace.some((s) => s.toolCalls.some((c) => c.name === "get_anomalies")));
  check("agent answer references the anomaly data",
    /anomal/i.test(result.answer) && result.answer.includes("MOCK-8SPK2W5TYN"),
    result.answer.slice(0, 80));
  check("agent did not degrade with scripted model", result.degraded === false);
  console.log(`    answer: ${result.answer.slice(0, 120)}…`);

  // Degraded path: model unreachable -> clear message, no throw.
  const dead: ChatFn = async () => ({ text: "", toolCalls: [], error: "boom" });
  const degraded = await runAgentTurn(createAiHarness(dead), spendAgent, "test?");
  check("unreachable model degrades with explanation",
    degraded.degraded === true && degraded.answer.length > 20);

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
