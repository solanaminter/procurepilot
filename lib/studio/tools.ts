// ProcurePilot — Studio agent domain tools.
//
// Server-side tools the spend-analyst agent calls during its turn. Each tool
// reads from the existing data layer (ledger + 120-product catalog); nothing
// here touches the PayPal adapter, so real sandbox orders drop in through
// getLedgerOrders() with zero rework when credentials land.

import { getLedgerOrders, getLedgerSummary, type LedgerOrder } from "../ledger";
import { getChannel3 } from "../adapters";
import { detectAnomalies } from "./anomalies";
import type { StudioToolDef } from "./types";

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function orderSummary(o: LedgerOrder) {
  return {
    orderId: o.orderId,
    date: o.createdAt.slice(0, 10),
    status: o.status,
    merchant: o.merchantDisplay,
    category: o.category,
    total: money(o.totalCents),
    saved: money(o.savingsCents),
    items: o.lines.map((l) => `${l.title} ×${l.quantity} @ ${money(l.unitPriceCents)}`).join("; "),
  };
}

const getOrders: StudioToolDef = {
  name: "get_orders",
  description:
    "List recent procurement orders, newest first. Use to answer questions about what was bought, when, and for how much.",
  parameters: {
    type: "object",
    properties: {
      limit: { type: "integer", description: "Max orders to return (default 10, max 50)." },
      status: {
        type: "string",
        description: "Filter by status.",
        enum: ["CREATED", "APPROVED", "COMPLETED"],
      },
    },
  },
  execute: (input) => {
    const limit = Math.min(50, Math.max(1, Number(input.limit ?? 10) || 10));
    const status = input.status as string | undefined;
    let orders = getLedgerOrders();
    if (status) orders = orders.filter((o) => o.status === status);
    return {
      count: orders.length,
      orders: orders.slice(0, limit).map(orderSummary),
    };
  },
};

const getOrderDetail: StudioToolDef = {
  name: "get_order_detail",
  description: "Full detail for one order: line items, prices, merchant, approval trail.",
  parameters: {
    type: "object",
    properties: {
      orderId: { type: "string", description: "The order ID, e.g. MOCK-7KX2P9Q4RA." },
    },
    required: ["orderId"],
  },
  execute: (input) => {
    const o = getLedgerOrders().find((x) => x.orderId === input.orderId);
    if (!o) return { error: `No order found with ID ${input.orderId}.` };
    return {
      ...orderSummary(o),
      approvedBy: o.approvedBy,
      approvedAt: o.approvedAt,
      approvalUrl: o.approvalUrl,
      lines: o.lines.map((l) => ({
        title: l.title,
        merchant: l.merchant,
        quantity: l.quantity,
        unitPrice: money(l.unitPriceCents),
        shipping: money(l.shippingCents),
        lineTotal: money(l.quantity * l.unitPriceCents + l.shippingCents),
      })),
    };
  },
};

const spendByCategory: StudioToolDef = {
  name: "spend_by_category",
  description: "Total spend and order count per product category.",
  parameters: { type: "object", properties: {} },
  execute: () => {
    const byCat = new Map<string, { totalCents: number; orders: number }>();
    for (const o of getLedgerOrders()) {
      const e = byCat.get(o.category) ?? { totalCents: 0, orders: 0 };
      e.totalCents += o.totalCents;
      e.orders += 1;
      byCat.set(o.category, e);
    }
    return [...byCat.entries()]
      .map(([category, v]) => ({
        category,
        total: money(v.totalCents),
        orders: v.orders,
      }))
      .sort((a, b) => b.orders - a.orders);
  },
};

const spendByMerchant: StudioToolDef = {
  name: "spend_by_merchant",
  description: "Total spend and order count per merchant. Use for supplier questions.",
  parameters: { type: "object", properties: {} },
  execute: () => {
    const byMer = new Map<string, { totalCents: number; orders: number }>();
    for (const o of getLedgerOrders()) {
      for (const l of o.lines) {
        const e = byMer.get(l.merchant) ?? { totalCents: 0, orders: 0 };
        e.totalCents += l.quantity * l.unitPriceCents + l.shippingCents;
        e.orders += 1;
        byMer.set(l.merchant, e);
      }
    }
    return [...byMer.entries()]
      .map(([merchant, v]) => ({
        merchant,
        total: money(v.totalCents),
        lineItems: v.orders,
      }))
      .sort((a, b) => b.total.localeCompare(a.total));
  },
};

const priceHistory: StudioToolDef = {
  name: "price_history",
  description:
    "Chronological unit prices paid for a product across orders. Use for price-drift and supplier-increase questions. Matches by product title keywords.",
  parameters: {
    type: "object",
    properties: {
      product: { type: "string", description: "Product keywords, e.g. 'toner' or 'coffee pods'." },
    },
    required: ["product"],
  },
  execute: (input) => {
    const q = String(input.product ?? "").toLowerCase();
    const rows: { date: string; product: string; merchant: string; unitPrice: string; orderId: string }[] = [];
    for (const o of getLedgerOrders()) {
      for (const l of o.lines) {
        if (l.title.toLowerCase().includes(q)) {
          rows.push({
            date: o.createdAt.slice(0, 10),
            product: l.title,
            merchant: l.merchant,
            unitPrice: money(l.unitPriceCents),
            orderId: o.orderId,
          });
        }
      }
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    if (rows.length === 0) return { error: `No purchases found matching "${input.product}".` };
    const first = Number(rows[0].unitPrice.replace(/[$,]/g, ""));
    const last = Number(rows[rows.length - 1].unitPrice.replace(/[$,]/g, ""));
    return {
      purchases: rows,
      driftPct: first > 0 ? (((last - first) / first) * 100).toFixed(1) + "%" : "n/a",
    };
  },
};

const getAnomalies: StudioToolDef = {
  name: "get_anomalies",
  description:
    "Deterministic anomaly scan of the order stream: unusually large orders, possible duplicate re-orders within 7 days, and supplier price spikes ≥15%. Always check this when asked about risks, fraud, or 'anything unusual'.",
  parameters: { type: "object", properties: {} },
  execute: () => {
    const list = detectAnomalies();
    return {
      count: list.length,
      anomalies: list.map((a) => ({
        kind: a.kind,
        severity: a.severity,
        orderId: a.orderId,
        title: a.title,
        detail: a.detail,
      })),
    };
  },
};

const spendSummary: StudioToolDef = {
  name: "spend_summary",
  description: "Overall ledger summary: total spend, total saved vs naive buying, savings rate, order count, pending approvals.",
  parameters: { type: "object", properties: {} },
  execute: () => {
    const s = getLedgerSummary();
    return {
      totalSpend: money(s.totalSpendCents),
      totalSaved: money(s.totalSavingsCents),
      savingsRatePct: Number(s.savingsRatePct.toFixed(1)),
      orderCount: s.orderCount,
      pendingApprovals: s.pendingApprovals,
    };
  },
};

const searchCatalog: StudioToolDef = {
  name: "search_catalog",
  description:
    "Current market offers for a product from the 120-product catalog. Use to compare a paid price against today's market ('is this price fair?').",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Product keywords, e.g. 'laser toner'." },
      limit: { type: "integer", description: "Max offers (default 5, max 10)." },
    },
    required: ["query"],
  },
  execute: async (input) => {
    const limit = Math.min(10, Math.max(1, Number(input.limit ?? 5) || 5));
    const offers = await getChannel3().searchProducts({
      query: String(input.query ?? ""),
      limit,
    });
    return offers.map((o) => ({
      title: o.title,
      merchant: o.merchant,
      price: money(o.priceCents),
      shipping: money(o.shippingCents),
      rating: o.rating,
    }));
  },
};

export const SPEND_AGENT_TOOLS: StudioToolDef[] = [
  getOrders,
  getOrderDetail,
  spendSummary,
  spendByCategory,
  spendByMerchant,
  priceHistory,
  getAnomalies,
  searchCatalog,
];
