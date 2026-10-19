// ProcurePilot — merchant dashboard data layer (server-side).
//
// Joins CreatedOrder records (seeded history + live orders from the mock
// PayPal store) with the enrichment the dashboard needs: savings vs. the
// naive buy, category buckets, and the human-approval trail. The adapter
// contracts in lib/adapters/types.ts are NOT modified — enrichment lives
// here, keyed by orderId.
//
// Cross-route state: Next.js 16 isolates module state between routes (even in
// production `next start`), so in-memory Maps alone cannot carry a live order
// from the API route to the dashboard page. Live orders are therefore ALSO
// appended to a small JSON file in the OS temp dir, which the dashboard reads
// back on every request. Seeded data is unaffected and always present.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { CreatedOrder, OrderLine } from "./adapters/types";
import { listMockOrders } from "./adapters/mock-paypal";
import { offerBucket } from "./adapters/mock-channel3";

export interface LedgerOrder extends CreatedOrder {
  /** Cents saved vs. the naive (priciest qualifying) buy. */
  savingsCents: number;
  /** What the naive buy would have cost, in cents. */
  naiveTotalCents: number;
  /** Primary spend bucket ("Packaging" | "Office" | "Cleaning" | "Breakroom" | "Mixed"). */
  category: string;
  /** "Merchant A" or "Merchant A +2" for multi-merchant orders. */
  merchantDisplay: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface ApprovalRecord {
  approvalId: string;
  orderId: string;
  approvedBy: string;
  approvedAt: string;
  itemSummary: string;
  totalCents: number;
  savingsCents: number;
  status: CreatedOrder["status"];
}

export interface LedgerSummary {
  orderCount: number;
  totalSpendCents: number;
  totalSavingsCents: number;
  totalNaiveCents: number;
  savingsRatePct: number;
  pendingApprovals: number;
}

// ─── Seed data ───────────────────────────────────────────────────────────
// Deterministic demo history: 16 orders over the last ~8 weeks, built from
// real mock-catalog products/merchants. IDs match the mock adapter's
// MOCK-XXXXXXXXXX shape. Approval timestamps trail creation by 1–3h.

interface SeedLine {
  offerId: string;
  title: string;
  merchant: string;
  quantity: number;
  unitPriceCents: number;
  shippingCents: number;
}

interface SeedSpec {
  id: string;
  createdAt: string;
  status: CreatedOrder["status"];
  approvedAt: string | null;
  savingsPct: number;
  lines: SeedLine[];
}

const APPROVER = "Solana Minter";

const SEED: SeedSpec[] = [
  {
    id: "MOCK-7KX2P9Q4RA",
    createdAt: "2026-08-12T14:22:00Z",
    status: "COMPLETED",
    approvedAt: "2026-08-12T16:05:00Z",
    savingsPct: 0.18,
    lines: [
      { offerId: "box-matte-10x8x6-2", title: "Matte Shipping Boxes 10x8x6 (25-pack)", merchant: "ShipWell", quantity: 8, unitPriceCents: 2149, shippingCents: 495 },
    ],
  },
  {
    id: "MOCK-3M8D2W5TYN",
    createdAt: "2026-08-19T10:05:00Z",
    status: "COMPLETED",
    approvedAt: "2026-08-19T11:41:00Z",
    savingsPct: 0.12,
    lines: [
      { offerId: "paper-a4-10ream-2", title: "A4 Copy Paper 80gsm (10 reams x 500 sheets)", merchant: "SupplyNest", quantity: 5, unitPriceCents: 5199, shippingCents: 0 },
    ],
  },
  {
    id: "MOCK-9Q4RA7KX2P",
    createdAt: "2026-08-26T16:40:00Z",
    status: "COMPLETED",
    approvedAt: "2026-08-26T18:12:00Z",
    savingsPct: 0.15,
    lines: [
      { offerId: "sanitizer-4pk-2", title: "Surface Sanitizer Spray (4-pack, 32oz)", merchant: "SupplyNest", quantity: 6, unitPriceCents: 1749, shippingCents: 495 },
      { offerId: "paper-towels-12pk-2", title: "Paper Towels 2-Ply (12-pack)", merchant: "SupplyNest", quantity: 4, unitPriceCents: 2149, shippingCents: 0 },
    ],
  },
  {
    id: "MOCK-2W5TYN9Q4R",
    createdAt: "2026-09-02T09:15:00Z",
    status: "COMPLETED",
    approvedAt: "2026-09-02T10:02:00Z",
    savingsPct: 0.1,
    lines: [
      { offerId: "coffee-pods-96-3", title: "Coffee Pods Medium Roast (96-count)", merchant: "StorePlus", quantity: 3, unitPriceCents: 4199, shippingCents: 295 },
      { offerId: "paper-cups-12oz-500-5", title: "Paper Hot Cups 12oz (500-pack)", merchant: "StorePlus", quantity: 2, unitPriceCents: 3449, shippingCents: 295 },
    ],
  },
  {
    id: "MOCK-5TYN9Q4RA7",
    createdAt: "2026-09-09T13:30:00Z",
    status: "COMPLETED",
    approvedAt: "2026-09-09T15:55:00Z",
    savingsPct: 0.14,
    lines: [
      { offerId: "packing-tape-hd-2", title: "Heavy-Duty Packing Tape 2in (6-pack)", merchant: "ShipWell", quantity: 6, unitPriceCents: 1799, shippingCents: 295 },
      { offerId: "ship-labels-2x4-2", title: "Self-Adhesive Shipping Labels 2x4in (500-pack)", merchant: "ShipWell", quantity: 4, unitPriceCents: 1299, shippingCents: 295 },
    ],
  },
  {
    id: "MOCK-8D2W5TYN9Q",
    createdAt: "2026-09-14T11:00:00Z",
    status: "COMPLETED",
    approvedAt: "2026-09-14T12:20:00Z",
    savingsPct: 0.09,
    lines: [
      { offerId: "toner-laser-black-3", title: "Laser Toner Cartridge Black (high yield)", merchant: "SupplyNest", quantity: 2, unitPriceCents: 8499, shippingCents: 495 },
    ],
  },
  {
    id: "MOCK-4RA7KX2P9Q",
    createdAt: "2026-09-18T15:20:00Z",
    status: "COMPLETED",
    approvedAt: "2026-09-18T16:44:00Z",
    savingsPct: 0.16,
    lines: [
      { offerId: "hand-soap-foam-6pk-1", title: "Foaming Hand Soap Refill (6-pack, 1L)", merchant: "CleanPro", quantity: 5, unitPriceCents: 2799, shippingCents: 0 },
      { offerId: "trash-bags-tall-110-1", title: "Tall Kitchen Trash Bags 13gal (110-pack)", merchant: "CleanPro", quantity: 6, unitPriceCents: 1999, shippingCents: 0 },
    ],
  },
  {
    id: "MOCK-6KX2P9Q4RA",
    createdAt: "2026-09-23T10:45:00Z",
    status: "COMPLETED",
    approvedAt: "2026-09-23T11:30:00Z",
    savingsPct: 0.11,
    lines: [
      { offerId: "pen-ballpoint-60-3", title: "Ballpoint Pens Medium Point (60-pack)", merchant: "SupplyNest", quantity: 10, unitPriceCents: 999, shippingCents: 395 },
      { offerId: "notebook-spiral-12-3", title: "Spiral Notebooks College Ruled (12-pack)", merchant: "SupplyNest", quantity: 6, unitPriceCents: 2199, shippingCents: 495 },
    ],
  },
  {
    id: "MOCK-2P9Q4RA7KX",
    createdAt: "2026-09-28T14:10:00Z",
    status: "COMPLETED",
    approvedAt: "2026-09-28T15:01:00Z",
    savingsPct: 0.13,
    lines: [
      { offerId: "bubble-wrap-12x100-2", title: "Bubble Wrap Roll 12in x 100ft", merchant: "Packlane", quantity: 4, unitPriceCents: 1999, shippingCents: 495 },
    ],
  },
  {
    id: "MOCK-7YN9Q4RA2W",
    createdAt: "2026-10-01T09:30:00Z",
    status: "COMPLETED",
    approvedAt: "2026-10-01T10:15:00Z",
    savingsPct: 0.17,
    lines: [
      { offerId: "poly-mailer-10x13-4", title: "Poly Mailers 10x13 (100-pack)", merchant: "SupplyNest", quantity: 10, unitPriceCents: 1299, shippingCents: 595 },
    ],
  },
  {
    id: "MOCK-9Q4RA2W5TY",
    createdAt: "2026-10-03T16:00:00Z",
    status: "COMPLETED",
    approvedAt: "2026-10-03T17:22:00Z",
    savingsPct: 0.08,
    lines: [
      { offerId: "paper-towels-12pk-3", title: "Paper Towels 2-Ply (12-pack)", merchant: "BulkMart", quantity: 8, unitPriceCents: 1899, shippingCents: 995 },
    ],
  },
  {
    id: "MOCK-4RA2W5TYN9",
    createdAt: "2026-10-04T11:20:00Z",
    status: "APPROVED",
    approvedAt: "2026-10-04T12:05:00Z",
    savingsPct: 0.12,
    lines: [
      { offerId: "coffee-pods-96-1", title: "Coffee Pods Medium Roast (96-count)", merchant: "BrewBox", quantity: 2, unitPriceCents: 4499, shippingCents: 0 },
    ],
  },
  {
    id: "MOCK-2W5TYN9Q4A",
    createdAt: "2026-10-05T13:45:00Z",
    status: "APPROVED",
    approvedAt: "2026-10-05T14:30:00Z",
    savingsPct: 0.19,
    lines: [
      { offerId: "box-matte-10x8x6-1", title: "Matte Shipping Boxes 10x8x6 (25-pack)", merchant: "Packlane", quantity: 4, unitPriceCents: 2299, shippingCents: 0 },
    ],
  },
  {
    id: "MOCK-8X2P9Q4RA7",
    createdAt: "2026-10-06T08:15:00Z",
    status: "CREATED",
    approvedAt: null,
    savingsPct: 0,
    lines: [
      { offerId: "ship-labels-2x4-1", title: "Self-Adhesive Shipping Labels 2x4in (500-pack)", merchant: "OfficeHub", quantity: 2, unitPriceCents: 1399, shippingCents: 0 },
    ],
  },
  // ── Seeded anomalies (for the Studio anomaly detectors) ──────────────
  // A same-week re-order of poly mailers (duplicate) and a bulk toner buy
  // at a spiked unit price (price spike + unusual amount).
  {
    id: "MOCK-3DUP9Q4RA7",
    createdAt: "2026-10-06T15:40:00Z",
    status: "APPROVED",
    approvedAt: "2026-10-06T16:20:00Z",
    savingsPct: 0.1,
    lines: [
      { offerId: "poly-mailer-10x13-4", title: "Poly Mailers 10x13 (100-pack)", merchant: "SupplyNest", quantity: 10, unitPriceCents: 1299, shippingCents: 595 },
    ],
  },
  {
    id: "MOCK-8SPK2W5TYN",
    createdAt: "2026-10-08T10:05:00Z",
    status: "APPROVED",
    approvedAt: "2026-10-08T11:47:00Z",
    savingsPct: 0.05,
    lines: [
      { offerId: "toner-laser-black-3", title: "Laser Toner Cartridge Black (high yield)", merchant: "SupplyNest", quantity: 12, unitPriceCents: 9999, shippingCents: 495 },
    ],
  },
];

function lineTotal(l: OrderLine): number {
  return l.quantity * l.unitPriceCents + l.shippingCents;
}

function buildLedgerOrder(spec: SeedSpec): LedgerOrder {
  const lines: OrderLine[] = spec.lines.map((l) => ({ ...l }));
  const totalCents = lines.reduce((s, l) => s + lineTotal(l), 0);
  const savingsCents = Math.round(totalCents * spec.savingsPct);
  const buckets = [...new Set(lines.map((l) => offerBucket(l.offerId)))];
  const merchants = [...new Set(lines.map((l) => l.merchant))];
  return {
    orderId: spec.id,
    status: spec.status,
    approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${spec.id}`,
    totalCents,
    currency: "USD",
    lines,
    createdAt: spec.createdAt,
    savingsCents,
    naiveTotalCents: totalCents + savingsCents,
    category: buckets.length === 1 ? buckets[0] : "Mixed",
    merchantDisplay:
      merchants.length === 1
        ? merchants[0]
        : `${merchants[0]} +${merchants.length - 1}`,
    approvedBy: spec.approvedAt ? APPROVER : null,
    approvedAt: spec.approvedAt,
  };
}

function summarizeItems(order: LedgerOrder): string {
  const first = order.lines[0];
  const label = `${first.title} ×${first.quantity}`;
  return order.lines.length > 1
    ? `${label} +${order.lines.length - 1} more`
    : label;
}

const SEEDED_ORDERS: LedgerOrder[] = SEED.map(buildLedgerOrder);
const SEEDED_IDS = new Set(SEEDED_ORDERS.map((o) => o.orderId));

// ---------------------------------------------------------------------------
// Live orders — cross-route persistence.
//
// Next.js 16 gives each route its own module instance (dev AND production),
// so the in-memory mock-PayPal store written by POST /api/orders is invisible
// to the dashboard page. Every live order is therefore also appended to a
// JSON file in the OS temp dir; getLedgerOrders()/getApprovals() read it back.
// In-memory Maps are kept as well so direct (non-route) consumers — evals,
// scripts — see live orders without touching the filesystem.
// ---------------------------------------------------------------------------

const LIVE_LEDGER_PATH = path.join(os.tmpdir(), "procurepilot-live-ledger.json");
const LIVE_LEDGER_CAP = 100;

interface LiveLedgerEntry {
  order: CreatedOrder;
  recordedAt: string;
}

function readLiveLedger(): LiveLedgerEntry[] {
  try {
    const raw = fs.readFileSync(LIVE_LEDGER_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is LiveLedgerEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as LiveLedgerEntry).recordedAt === "string" &&
        typeof (e as LiveLedgerEntry).order?.orderId === "string",
    );
  } catch {
    return [];
  }
}

function appendLiveLedger(order: CreatedOrder): void {
  try {
    const entries = readLiveLedger().filter((e) => e.order.orderId !== order.orderId);
    entries.push({ order, recordedAt: new Date().toISOString() });
    const capped = entries.slice(-LIVE_LEDGER_CAP);
    fs.writeFileSync(LIVE_LEDGER_PATH, JSON.stringify(capped), "utf8");
  } catch {
    // Best-effort: a ledger write must never break order creation.
  }
}

// Live approvals recorded when orders are placed from the chat UI this session.
const liveApprovals: ApprovalRecord[] = [];
const liveEnrichment = new Map<string, Pick<LedgerOrder, "savingsCents" | "naiveTotalCents" | "category" | "merchantDisplay" | "approvedBy" | "approvedAt">>();

let approvalSeq = 100;

function buildLiveEnrichment(order: CreatedOrder, approvedAt: string) {
  const buckets = [...new Set(order.lines.map((l) => offerBucket(l.offerId)))];
  const merchants = [...new Set(order.lines.map((l) => l.merchant))];
  return {
    savingsCents: 0,
    naiveTotalCents: order.totalCents,
    category: buckets.length === 1 ? buckets[0] : "Mixed",
    merchantDisplay:
      merchants.length === 1 ? merchants[0] : `${merchants[0]} +${merchants.length - 1}`,
    approvedBy: APPROVER,
    approvedAt,
  };
}

/** Recorded by POST /api/orders after a successful createOrder (best-effort). */
export function recordLiveApproval(order: CreatedOrder): void {
  appendLiveLedger(order);
  if (liveEnrichment.has(order.orderId) || SEEDED_IDS.has(order.orderId)) return;
  const approvedAt = new Date().toISOString();
  liveEnrichment.set(order.orderId, buildLiveEnrichment(order, approvedAt));
  const enriched = enrichLive(order);
  liveApprovals.push({
    approvalId: `APR-${approvalSeq++}`,
    orderId: order.orderId,
    approvedBy: APPROVER,
    approvedAt,
    itemSummary: summarizeItems(enriched),
    totalCents: order.totalCents,
    savingsCents: 0,
    status: order.status,
  });
}

function enrichLive(order: CreatedOrder, recordedAt?: string): LedgerOrder {
  const e = liveEnrichment.get(order.orderId) ??
    buildLiveEnrichment(order, recordedAt ?? order.createdAt);
  return { ...order, ...e };
}

/** All orders: seeded history + live session orders, newest first. */
export function getLedgerOrders(): LedgerOrder[] {
  const seen = new Set<string>(SEEDED_IDS);
  const live: LedgerOrder[] = [];
  const pushLive = (o: CreatedOrder, recordedAt?: string) => {
    if (seen.has(o.orderId)) return;
    seen.add(o.orderId);
    live.push(enrichLive(o, recordedAt));
  };
  // File-backed entries first (visible across routes), then in-memory store
  // (covers direct non-route consumers); deduped by orderId either way.
  for (const entry of readLiveLedger()) pushLive(entry.order, entry.recordedAt);
  for (const o of listMockOrders()) pushLive(o);
  return [...SEEDED_ORDERS, ...live].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );
}

/** Approval history, newest first. Seeded approvals come from the seed specs. */
export function getApprovals(): ApprovalRecord[] {
  const seeded: ApprovalRecord[] = SEEDED_ORDERS.filter((o) => o.approvedAt).map(
    (o, i) => ({
      approvalId: `APR-${2400 + i}`,
      orderId: o.orderId,
      approvedBy: APPROVER,
      approvedAt: o.approvedAt as string,
      itemSummary: summarizeItems(o),
      totalCents: o.totalCents,
      savingsCents: o.savingsCents,
      status: o.status,
    }),
  );
  const seen = new Set(seeded.map((a) => a.orderId));
  const live: ApprovalRecord[] = [];
  const pushApproval = (a: ApprovalRecord) => {
    if (seen.has(a.orderId)) return;
    seen.add(a.orderId);
    live.push(a);
  };
  // File-backed live orders imply an approval each (chat flow is tap-to-approve).
  for (const entry of readLiveLedger()) {
    const enriched = enrichLive(entry.order, entry.recordedAt);
    pushApproval({
      approvalId: `APR-${entry.order.orderId.replace(/^MOCK-/, "")}`,
      orderId: entry.order.orderId,
      approvedBy: APPROVER,
      approvedAt: entry.recordedAt,
      itemSummary: summarizeItems(enriched),
      totalCents: entry.order.totalCents,
      savingsCents: 0,
      status: entry.order.status,
    });
  }
  for (const a of liveApprovals) pushApproval(a);
  return [...seeded, ...live].sort(
    (a, b) => +new Date(b.approvedAt) - +new Date(a.approvedAt),
  );
}

export function getLedgerSummary(): LedgerSummary {
  const orders = getLedgerOrders();
  const totalSpendCents = orders.reduce((s, o) => s + o.totalCents, 0);
  const totalSavingsCents = orders.reduce((s, o) => s + o.savingsCents, 0);
  const totalNaiveCents = totalSpendCents + totalSavingsCents;
  return {
    orderCount: orders.length,
    totalSpendCents,
    totalSavingsCents,
    totalNaiveCents,
    savingsRatePct:
      totalNaiveCents > 0 ? (totalSavingsCents / totalNaiveCents) * 100 : 0,
    pendingApprovals: orders.filter((o) => o.status === "CREATED").length,
  };
}
