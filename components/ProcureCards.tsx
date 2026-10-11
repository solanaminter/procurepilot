"use client";

import type {
  ProcurementIntent,
  ProductOffer,
} from "../lib/adapters/types";
import { fmtUSD } from "./format";

export function IntentCard({ intent }: { intent: ProcurementIntent }) {
  const constraints: string[] = [];
  if (intent.maxUnitPriceCents != null)
    constraints.push(`≤ ${fmtUSD(intent.maxUnitPriceCents)}/unit`);
  if (intent.maxTotalCents != null)
    constraints.push(`≤ ${fmtUSD(intent.maxTotalCents)} total`);
  if (intent.maxShippingEtaDays != null)
    constraints.push(`≤ ${intent.maxShippingEtaDays}d delivery`);

  return (
    <div className="mt-3 rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Understood request
      </p>
      <p className="mt-1 font-medium text-neutral-100">
        {intent.itemDescription}
        <span className="ml-2 text-sm font-normal text-neutral-400">
          × {intent.quantity}
        </span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {constraints.length > 0 ? (
          constraints.map((c) => (
            <span
              key={c}
              className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs text-neutral-300"
            >
              {c}
            </span>
          ))
        ) : (
          <span className="text-xs text-neutral-500">No price/time limits</span>
        )}
      </div>
      {intent.notes ? (
        <p className="mt-2 text-sm text-neutral-500">{intent.notes}</p>
      ) : null}
    </div>
  );
}

export function OffersCard({ offers }: { offers: ProductOffer[] }) {
  return (
    <div className="mt-3 w-full overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950">
      <div className="border-b border-neutral-800 px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {offers.length} merchant offer{offers.length === 1 ? "" : "s"} found
        </p>
      </div>
      <ul className="divide-y divide-neutral-800">
        {offers.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-100">
                {o.title}
              </p>
              <p className="text-xs text-neutral-500">
                {o.merchant} · {o.rating.toFixed(1)}★ ({o.reviewCount.toLocaleString()}) ·{" "}
                {o.shippingEtaDays}d ·{" "}
                {o.inStock ? (
                  <span className="text-emerald-400">In stock</span>
                ) : (
                  <span className="text-red-400">Out of stock</span>
                )}
              </p>
            </div>
            <div className="shrink-0 text-right text-sm">
              <p className="font-medium text-neutral-100">
                {fmtUSD(o.priceCents)}
              </p>
              <p className="text-xs text-neutral-500">
                {o.shippingCents === 0 ? "free ship" : `+${fmtUSD(o.shippingCents)} ship`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
