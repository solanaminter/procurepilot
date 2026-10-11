"use client";

import type { CreatedOrder } from "../lib/adapters/types";
import { fmtDateTime, fmtUSD } from "./format";

const STATUS_STYLES: Record<CreatedOrder["status"], string> = {
  CREATED: "bg-sky-950 text-sky-300 border-sky-800",
  APPROVED: "bg-amber-950 text-amber-300 border-amber-800",
  COMPLETED: "bg-emerald-950 text-emerald-300 border-emerald-800",
};

export default function OrderStatusCard({ order }: { order: CreatedOrder }) {
  return (
    <div className="mt-3 w-full overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950">
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-neutral-100">Order placed</h3>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[order.status]}`}
          >
            {order.status}
          </span>
        </div>
        <p className="mt-1 font-mono text-xs text-neutral-500">
          Order ID: {order.orderId}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">
          Created {fmtDateTime(order.createdAt)}
        </p>
      </div>

      <div className="divide-y divide-neutral-800 px-4">
        {order.lines.map((line) => (
          <div
            key={line.offerId}
            className="flex items-start justify-between gap-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-100">
                {line.title}
              </p>
              <p className="text-xs text-neutral-500">
                {line.merchant} · {line.quantity} × {fmtUSD(line.unitPriceCents)}
              </p>
            </div>
            <p className="shrink-0 text-sm text-neutral-300">
              {fmtUSD(line.quantity * line.unitPriceCents + line.shippingCents)}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-neutral-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-400">Total</span>
          <span className="text-lg font-bold text-neutral-100">
            {fmtUSD(order.totalCents)}{" "}
            <span className="text-xs font-normal text-neutral-500">
              {order.currency}
            </span>
          </span>
        </div>
        {order.approvalUrl ? (
          <div className="mt-3 rounded-lg bg-neutral-900 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              PayPal approval URL (mock)
            </p>
            <p className="mt-1 break-all font-mono text-xs text-sky-300">
              {order.approvalUrl}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Sandbox placeholder — no real payment is processed in this demo.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
