// ProcurePilot — deterministic anomaly detectors over the order ledger.
//
// Three detectors, all explainable and unit-testable (no LLM involved):
//   1. unusual_amount  — order total far above the typical range
//   2. duplicate_order — same product re-ordered within 7 days
//   3. price_spike     — same product's unit price jumped ≥15% vs its last buy
//
// The Studio agent's get_anomalies tool and the /api/studio/anomalies route
// both read from here. Seeded demo history intentionally contains one of
// each so judges see the full story on first load.

import { getLedgerOrders, type LedgerOrder } from "../ledger";

export type AnomalyKind = "unusual_amount" | "duplicate_order" | "price_spike";

export interface Anomaly {
  id: string;
  kind: AnomalyKind;
  severity: "high" | "medium";
  orderId: string;
  title: string;
  detail: string;
  createdAt: string;
  totalCents: number;
}

const DUPLICATE_WINDOW_DAYS = 7;
const PRICE_SPIKE_PCT = 0.15;
const UNUSUAL_AMOUNT_MULTIPLE = 3;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Orders with a settled/approved status — pending CREATED orders are excluded. */
export function settledOrders(orders: LedgerOrder[] = getLedgerOrders()): LedgerOrder[] {
  return orders.filter((o) => o.status !== "CREATED");
}

function detectUnusualAmounts(orders: LedgerOrder[]): Anomaly[] {
  const settled = settledOrders(orders);
  const med = median(settled.map((o) => o.totalCents));
  const threshold = med * UNUSUAL_AMOUNT_MULTIPLE;
  return settled
    .filter((o) => o.totalCents > threshold)
    .map((o) => ({
      id: `anom-amount-${o.orderId}`,
      kind: "unusual_amount" as const,
      severity: "high" as const,
      orderId: o.orderId,
      title: `Unusually large order — ${fmtMoney(o.totalCents)}`,
      detail:
        `Order ${o.orderId} totals ${fmtMoney(o.totalCents)}, ` +
        `${(o.totalCents / med).toFixed(1)}× the median order ` +
        `(${fmtMoney(med)}). Items: ${o.lines.map((l) => `${l.title} ×${l.quantity}`).join("; ")}.`,
      createdAt: o.createdAt,
      totalCents: o.totalCents,
    }));
}

interface Purchase {
  orderId: string;
  createdAt: string;
  offerId: string;
  title: string;
  merchant: string;
  quantity: number;
  unitPriceCents: number;
}

function purchasesByOffer(orders: LedgerOrder[]): Map<string, Purchase[]> {
  const byOffer = new Map<string, Purchase[]>();
  for (const o of settledOrders(orders)) {
    for (const l of o.lines) {
      const list = byOffer.get(l.offerId) ?? [];
      list.push({
        orderId: o.orderId,
        createdAt: o.createdAt,
        offerId: l.offerId,
        title: l.title,
        merchant: l.merchant,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
      });
      byOffer.set(l.offerId, list);
    }
  }
  for (const list of byOffer.values()) {
    list.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  }
  return byOffer;
}

function detectDuplicates(orders: LedgerOrder[]): Anomaly[] {
  const out: Anomaly[] = [];
  for (const list of purchasesByOffer(orders).values()) {
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      const days =
        (+new Date(cur.createdAt) - +new Date(prev.createdAt)) / 86_400_000;
      if (days <= DUPLICATE_WINDOW_DAYS) {
        const order = orders.find((o) => o.orderId === cur.orderId);
        out.push({
          id: `anom-dup-${cur.orderId}-${cur.offerId}`,
          kind: "duplicate_order",
          severity: "medium",
          orderId: cur.orderId,
          title: `Possible duplicate order — "${cur.title}"`,
          detail:
            `Ordered ${cur.quantity}× from ${cur.merchant} on ` +
            `${cur.createdAt.slice(0, 10)}, only ${days.toFixed(0)} day(s) after ` +
            `the previous order (${prev.orderId}, ${prev.quantity}× from ${prev.merchant}). ` +
            `Verify this wasn't a double-buy before approving.`,
          createdAt: cur.createdAt,
          totalCents: order?.totalCents ?? 0,
        });
      }
    }
  }
  return out;
}

function detectPriceSpikes(orders: LedgerOrder[]): Anomaly[] {
  const out: Anomaly[] = [];
  for (const list of purchasesByOffer(orders).values()) {
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      if (prev.unitPriceCents <= 0) continue;
      const drift = (cur.unitPriceCents - prev.unitPriceCents) / prev.unitPriceCents;
      if (drift >= PRICE_SPIKE_PCT) {
        const order = orders.find((o) => o.orderId === cur.orderId);
        out.push({
          id: `anom-spike-${cur.orderId}-${cur.offerId}`,
          kind: "price_spike",
          severity: "high",
          orderId: cur.orderId,
          title: `Supplier price spike — "${cur.title}" up ${(drift * 100).toFixed(1)}%`,
          detail:
            `${cur.merchant} raised the unit price from ${fmtMoney(prev.unitPriceCents)} ` +
            `(order ${prev.orderId}, ${prev.createdAt.slice(0, 10)}) to ` +
            `${fmtMoney(cur.unitPriceCents)} (order ${cur.orderId}, ` +
            `${cur.createdAt.slice(0, 10)}). Consider re-running the comparison ` +
            `before this ships.`,
          createdAt: cur.createdAt,
          totalCents: order?.totalCents ?? 0,
        });
      }
    }
  }
  return out;
}

/** All anomalies, newest first. Deterministic — same ledger, same output. */
export function detectAnomalies(orders: LedgerOrder[] = getLedgerOrders()): Anomaly[] {
  const all = [
    ...detectUnusualAmounts(orders),
    ...detectDuplicates(orders),
    ...detectPriceSpikes(orders),
  ];
  return all.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}
