// ProcurePilot — mock PayPal adapter (Phase 1).
// In-memory order store shaped like PayPal sandbox REST responses:
// order IDs look like `MOCK-8RU12345AB`, approval URL mimics
// https://www.sandbox.paypal.com/checkoutnow?token=<orderId>.
// No network calls, no credentials.
//
// Real adapter (Phase 2) will use the PayPal Orders v2 API with
// PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET (client-credentials OAuth).

import type { CreatedOrder, OrderLine, PayPalAdapter } from "./types";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const orders = new Map<string, CreatedOrder>();

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genOrderId(): string {
  let suffix = "";
  for (let i = 0; i < 10; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `MOCK-${suffix}`;
}

export const mockPayPal: PayPalAdapter = {
  async createOrder(lines: OrderLine[]): Promise<CreatedOrder> {
    await delay(200); // simulate network latency

    if (lines.length === 0) {
      throw new Error("createOrder requires at least one order line");
    }

    const orderId = genOrderId();
    const totalCents = lines.reduce(
      (sum, l) => sum + l.unitPriceCents * l.quantity + l.shippingCents,
      0,
    );

    const order: CreatedOrder = {
      orderId,
      status: "CREATED",
      approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`,
      totalCents,
      currency: "USD",
      lines: lines.map((l) => ({ ...l })),
      createdAt: new Date().toISOString(),
    };
    orders.set(orderId, order);
    return { ...order };
  },

  async captureOrder(orderId: string): Promise<CreatedOrder> {
    await delay(200); // simulate network latency

    const order = orders.get(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }
    // In the sandbox the payer approves via approvalUrl, which flips the
    // order to APPROVED; capture then completes it. The mock simulates the
    // full approval step: CREATED -> COMPLETED in one capture call.
    const completed: CreatedOrder = { ...order, status: "COMPLETED" };
    orders.set(orderId, completed);
    return { ...completed };
  },

  async getOrder(orderId: string): Promise<CreatedOrder> {
    await delay(200); // simulate network latency

    const order = orders.get(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }
    return { ...order };
  },
};

// ─── Dashboard support (additive; not part of the PayPalAdapter contract) ──
// Returns every order created in this server session, newest last. Used by the
// merchant dashboard to surface orders placed live from the chat UI.
export function listMockOrders(): CreatedOrder[] {
  return [...orders.values()].map((o) => ({
    ...o,
    lines: o.lines.map((l) => ({ ...l })),
  }));
}
