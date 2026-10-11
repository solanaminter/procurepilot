// ProcurePilot — PayPal order endpoints (Phase 1).
//
// POST /api/orders  { lines: OrderLine[] } → CreatedOrder (201)
// GET  /api/orders?id=<orderId>              → CreatedOrder (200)
// 400 on bad input; 404 when the order id is unknown.

import { getPayPal } from "@/lib/adapters";
import { recordLiveApproval } from "@/lib/ledger";
import type { OrderLine } from "@/lib/adapters/types";

function validLine(l: unknown): l is OrderLine {
  if (!l || typeof l !== "object") return false;
  const line = l as Record<string, unknown>;
  return (
    typeof line.offerId === "string" &&
    line.offerId.length > 0 &&
    typeof line.title === "string" &&
    typeof line.merchant === "string" &&
    typeof line.quantity === "number" &&
    Number.isInteger(line.quantity) &&
    line.quantity > 0 &&
    typeof line.unitPriceCents === "number" &&
    Number.isInteger(line.unitPriceCents) &&
    line.unitPriceCents >= 0 &&
    typeof line.shippingCents === "number" &&
    Number.isInteger(line.shippingCents) &&
    line.shippingCents >= 0
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const lines = (body as { lines?: unknown })?.lines;
  if (!Array.isArray(lines) || lines.length === 0) {
    return Response.json(
      { error: "`lines` must be a non-empty array of order lines." },
      { status: 400 },
    );
  }
  if (!lines.every(validLine)) {
    return Response.json(
      {
        error:
          "Each line needs offerId (string), title (string), merchant (string), " +
          "quantity (positive int), unitPriceCents (int ≥ 0), shippingCents (int ≥ 0).",
      },
      { status: 400 },
    );
  }

  try {
    const order = await getPayPal().createOrder(lines);
    // Best-effort: record the human approval for the dashboard ledger.
    // Never let ledger bookkeeping break order creation.
    try {
      recordLiveApproval(order);
    } catch {
      /* ledger is demo-only; ignore */
    }
    return Response.json(order, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Order creation failed." },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing required query param: ?id=" }, { status: 400 });
  }
  try {
    const order = await getPayPal().getOrder(id);
    return Response.json(order);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : `Order not found: ${id}` },
      { status: 404 },
    );
  }
}
