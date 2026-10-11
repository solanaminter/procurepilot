"use client";

import type { OrderLine } from "../lib/adapters/types";
import { fmtUSD } from "./format";

export default function ApprovalCard({
  proposal,
  onApprove,
  onReject,
  placing,
  ownerName,
}: {
  proposal: { lines: OrderLine[]; totalCents: number };
  onApprove: () => void;
  onReject: () => void;
  placing?: boolean;
  ownerName?: string;
}) {
  return (
    <div className="mt-3 w-full overflow-hidden rounded-xl border border-amber-700/50 bg-amber-950/20">
      <div className="border-b border-amber-700/30 px-4 py-3">
        <h3 className="font-semibold text-amber-200">Order proposal</h3>
        <p className="mt-0.5 text-xs text-amber-200/70">
          Human approval required before any payment is made.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          On approval, this order is placed by the ProcurePilot agent via PayPal
          sandbox — owner on record: {ownerName ?? "Solana Minter"}.
        </p>
      </div>

      <div className="divide-y divide-neutral-800 px-4">
        {proposal.lines.map((line) => (
          <div key={line.offerId} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-medium text-neutral-100">{line.title}</p>
              <p className="text-sm text-neutral-500">
                {line.merchant} · {line.quantity} × {fmtUSD(line.unitPriceCents)}
                {line.shippingCents > 0
                  ? ` + ${fmtUSD(line.shippingCents)} shipping`
                  : " · free shipping"}
              </p>
            </div>
            <p className="shrink-0 font-medium text-neutral-100">
              {fmtUSD(line.quantity * line.unitPriceCents + line.shippingCents)}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-amber-700/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-400">Total</span>
          <span className="text-lg font-bold text-neutral-100">
            {fmtUSD(proposal.totalCents)}
          </span>
        </div>
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={onApprove}
            disabled={placing}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {placing ? "Placing order…" : "Approve and place order"}
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={placing}
            className="rounded-lg border border-neutral-700 px-4 py-2.5 font-semibold text-neutral-300 transition hover:border-neutral-500 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
