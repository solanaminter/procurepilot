// ProcurePilot — Phase 1 evaluation harness.
// Runs the full agent loop (parse → search → compare → propose → PayPal
// create/capture/get) against 5 canned intents with zero credentials.
// Usage: npm run eval   (expects MOCK_MODE unset/true)
// Exit code: 0 when every case passes, 1 otherwise.

import { parseIntentMock } from "../lib/intent";
import { compareOffers } from "../lib/compare";
import { getAgentIdentity } from "../lib/agentid";
import { getChannel3, getPayPal } from "../lib/adapters";
import type {
  OrderLine,
  ProcurementIntent,
  ProductOffer,
} from "../lib/adapters/types";

interface ExpectedIntent {
  itemDescription: string;
  quantity: number;
  maxUnitPriceCents?: number;
  maxTotalCents?: number;
  maxShippingEtaDays?: number;
}

interface EvalCase {
  name: string;
  message: string;
  expectIntent: ExpectedIntent;
}

const CASES: EvalCase[] = [
  {
    name: "boxes: per-unit budget + 2-day delivery",
    message: "200 matte shipping boxes 10x8x6 under $1.20/unit, 2-day",
    expectIntent: {
      itemDescription: "matte shipping boxes 10x8x6",
      quantity: 8, // 200 boxes → 8 × 25-pack
      maxUnitPriceCents: 3000, // $1.20/box → $30.00/pack
      maxShippingEtaDays: 2,
    },
  },
  {
    name: "paper: total budget",
    message: "50 reams A4 paper under $300 total",
    expectIntent: {
      itemDescription: "A4 paper",
      quantity: 5, // 50 reams → 5 × 10-ream case
      maxTotalCents: 30000,
    },
  },
  {
    name: "soap: fast shipping",
    message: "30 bottles hand soap, fast shipping",
    expectIntent: {
      itemDescription: "hand soap",
      quantity: 5, // 30 bottles → 5 × 6-pack
      maxShippingEtaDays: 2,
    },
  },
  {
    name: "coffee pods: cheapest, no constraints",
    message: "100 coffee pods, cheapest",
    expectIntent: {
      itemDescription: "coffee pods",
      quantity: 2, // 100 pods → 2 × 96-count (rounded up)
    },
  },
  {
    name: "vague restock request",
    message: "we're running low on cleaning supplies",
    expectIntent: {
      itemDescription: "cleaning",
      quantity: 1,
    },
  },
];

// Independent brute-force reimplementation of the comparison, used to
// cross-check compareOffers.
function bruteForce(offers: ProductOffer[], intent: ProcurementIntent) {
  const qualifying = offers.filter(
    (o) =>
      o.inStock &&
      (intent.maxUnitPriceCents === undefined ||
        o.priceCents <= intent.maxUnitPriceCents) &&
      (intent.maxShippingEtaDays === undefined ||
        o.shippingEtaDays <= intent.maxShippingEtaDays),
  );
  if (qualifying.length === 0) throw new Error("brute force: no qualifying offers");
  const totals = qualifying
    .map((o) => ({ id: o.id, total: o.priceCents * intent.quantity + o.shippingCents }))
    .sort((a, b) => a.total - b.total);
  return {
    count: qualifying.length,
    order: totals.map((t) => t.id),
    bestId: totals[0].id,
    bestTotal: totals[0].total,
    maxTotal: totals[totals.length - 1].total,
  };
}

let failures = 0;

function check(caseName: string, label: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`    ✓ ${label}`);
  } else {
    failures += 1;
    console.log(`    ✗ ${label}${detail ? ` — ${detail}` : ""} [${caseName}]`);
  }
}

async function runCase(c: EvalCase) {
  console.log(`\n[CASE] ${c.name}`);
  console.log(`  message: "${c.message}"`);

  // 1. Intent parsing
  const intent = parseIntentMock(c.message);
  const e = c.expectIntent;
  check(c.name, "itemDescription", intent.itemDescription === e.itemDescription,
    `got "${intent.itemDescription}"`);
  check(c.name, "quantity", intent.quantity === e.quantity, `got ${intent.quantity}`);
  check(c.name, "maxUnitPriceCents", intent.maxUnitPriceCents === e.maxUnitPriceCents,
    `got ${intent.maxUnitPriceCents}`);
  check(c.name, "maxTotalCents", intent.maxTotalCents === e.maxTotalCents,
    `got ${intent.maxTotalCents}`);
  check(c.name, "maxShippingEtaDays", intent.maxShippingEtaDays === e.maxShippingEtaDays,
    `got ${intent.maxShippingEtaDays}`);
  if (intent.notes) console.log(`  notes: ${intent.notes}`);

  // 2. Search (same call shape as the chat route)
  const offers = await getChannel3().searchProducts({
    query: intent.itemDescription,
    maxPriceCents: intent.maxUnitPriceCents,
    maxShippingEtaDays: intent.maxShippingEtaDays,
    limit: 8,
  });
  check(c.name, "search returned offers", offers.length > 0, `got ${offers.length}`);
  console.log(`  search: ${offers.length} offer(s)`);

  // 3. Comparison vs brute force
  let comparison;
  try {
    comparison = compareOffers(offers, intent);
  } catch (err) {
    check(c.name, "compareOffers did not throw", false, String(err));
    return;
  }
  const expected = bruteForce(offers, intent);
  check(c.name, "ranked count matches", comparison.ranked.length === expected.count);
  check(
    c.name,
    "rank order matches brute force",
    JSON.stringify(comparison.ranked.map((r) => r.id)) === JSON.stringify(expected.order),
  );
  check(c.name, "best = cheapest qualifying", comparison.best.id === expected.bestId,
    `got ${comparison.best.id}, want ${expected.bestId}`);
  check(c.name, "best total consistent", comparison.best.totalCents === expected.bestTotal);
  check(
    c.name,
    "savingsCents = maxTotal − bestTotal ≥ 0",
    comparison.savingsCents === expected.maxTotal - expected.bestTotal &&
      comparison.savingsCents >= 0,
    `got ${comparison.savingsCents}`,
  );
  const pctOK =
    Math.abs(comparison.savingsPct - (comparison.savingsCents / expected.maxTotal) * 100) < 1e-9;
  check(c.name, "savingsPct math consistent", pctOK, `got ${comparison.savingsPct}`);
  check(c.name, "ranks are 1..N", comparison.ranked.every((r, i) => r.rank === i + 1));
  check(c.name, "summary non-empty", comparison.summary.length > 50);
  console.log(
    `  best: ${comparison.best.merchant} "${comparison.best.title}" $${(comparison.best.totalCents / 100).toFixed(2)} ` +
      `(save $${(comparison.savingsCents / 100).toFixed(2)}, ${comparison.savingsPct.toFixed(1)}%)`,
  );

  // 4. Order proposal → PayPal create → capture → get round-trip
  const lines: OrderLine[] = [
    {
      offerId: comparison.best.id,
      title: comparison.best.title,
      merchant: comparison.best.merchant,
      quantity: intent.quantity,
      unitPriceCents: comparison.best.priceCents,
      shippingCents: comparison.best.shippingCents,
    },
  ];
  const lineTotal = lines.reduce(
    (s, l) => s + l.unitPriceCents * l.quantity + l.shippingCents,
    0,
  );
  const paypal = getPayPal();
  const created = await paypal.createOrder(lines);
  check(c.name, "createOrder → CREATED", created.status === "CREATED", `got ${created.status}`);
  check(c.name, "createOrder total matches lines", created.totalCents === lineTotal,
    `got ${created.totalCents}, want ${lineTotal}`);
  check(c.name, "createOrder currency USD", created.currency === "USD");
  const captured = await paypal.captureOrder(created.orderId);
  check(c.name, "captureOrder → COMPLETED", captured.status === "COMPLETED",
    `got ${captured.status}`);
  const fetched = await paypal.getOrder(created.orderId);
  check(c.name, "getOrder → COMPLETED", fetched.status === "COMPLETED",
    `got ${fetched.status}`);
  check(c.name, "getOrder total matches created", fetched.totalCents === created.totalCents);
  check(c.name, "getOrder lines round-trip",
    JSON.stringify(fetched.lines) === JSON.stringify(lines));
  console.log(`  order: ${created.orderId} → ${fetched.status} $${(fetched.totalCents / 100).toFixed(2)}`);
}

async function main() {
  console.log("ProcurePilot eval — 5 canned intents, mock mode, zero credentials");
  for (const c of CASES) {
    try {
      await runCase(c);
    } catch (err) {
      failures += 1;
      console.log(`  ✗ unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // AgentID identity — claims shape + demo-mode default (zero secrets).
  console.log("\n[CASE] agentid: identity claims");
  const identity = getAgentIdentity();
  check("agentid", 'actorType is "agent"', identity.actorType === "agent");
  check("agentid", "stable sub present", identity.sub.length > 0, `got "${identity.sub}"`);
  check("agentid", "agent email present", identity.agentEmail.length > 0);
  check("agentid", "owner name present", identity.ownerName.length > 0);
  check(
    "agentid",
    "owner email well-formed",
    /.+@.+\..+/.test(identity.ownerEmail),
    `got "${identity.ownerEmail}"`,
  );
  check(
    "agentid",
    "demo mode when unconfigured",
    identity.mode === "demo" && identity.verified === false,
    `got mode=${identity.mode} verified=${identity.verified}`,
  );
  check(
    "agentid",
    "demo identity uses no real-looking inbox",
    !/agentmail\.to/.test(identity.agentEmail + identity.issuer),
    "demo identity must not impersonate a real AgentMail inbox",
  );
  console.log(`  identity: ${identity.agentEmail} (owner: ${identity.ownerName}, mode: ${identity.mode})`);

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`} — ${CASES.length} cases`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
