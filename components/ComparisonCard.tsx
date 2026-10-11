"use client";

import type { ComparisonResult } from "../lib/adapters/types";
import { fmtUSD } from "./format";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="whitespace-nowrap text-amber-400" title={`${rating} / 5`}>
      {"★".repeat(Math.round(rating))}
      <span className="text-neutral-600">
        {"★".repeat(5 - Math.round(rating))}
      </span>
    </span>
  );
}

export default function ComparisonCard({
  comparison,
  quantity,
}: {
  comparison: ComparisonResult;
  quantity: number;
}) {
  const { ranked, best, savingsCents, savingsPct, summary } = comparison;
  const sorted = [...ranked].sort((a, b) => a.rank - b.rank);

  return (
    <div className="mt-3 w-full overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950">
      {/* Savings banner */}
      <div className="border-b border-neutral-800 bg-emerald-950/60 px-4 py-3">
        <p className="text-sm font-semibold text-emerald-300">
          Save {fmtUSD(savingsCents)} ({savingsPct.toFixed(1)}%) vs naive buy
        </p>
        {summary ? (
          <p className="mt-1 text-sm text-neutral-400">{summary}</p>
        ) : null}
      </div>

      {/* Ranked offers */}
      <div className="divide-y divide-neutral-800">
        {sorted.map((offer) => {
          const isBest = offer.id === best.id;
          return (
            <div
              key={offer.id}
              className={`px-4 py-3 ${isBest ? "bg-emerald-950/30" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Rank #{offer.rank}
                    </span>
                    {isBest && (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                        Best pick
                      </span>
                    )}
                    {!offer.inStock && (
                      <span className="rounded-full bg-red-950 px-2 py-0.5 text-xs font-semibold text-red-400">
                        Out of stock
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-medium text-neutral-100">
                    {offer.title}
                  </p>
                  <p className="text-sm text-neutral-500">{offer.merchant}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-neutral-400">
                    {fmtUSD(offer.priceCents)}{" "}
                    <span className="text-neutral-600">/ unit</span>
                  </p>
                  <p className="text-base font-semibold text-neutral-100">
                    {fmtUSD(offer.totalCents)}{" "}
                    <span className="text-xs font-normal text-neutral-500">
                      landed
                    </span>
                  </p>
                </div>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-neutral-500">Shipping</dt>
                  <dd className="text-neutral-300">
                    {offer.shippingCents === 0
                      ? "Free"
                      : fmtUSD(offer.shippingCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">ETA</dt>
                  <dd className="text-neutral-300">
                    {offer.shippingEtaDays} day
                    {offer.shippingEtaDays === 1 ? "" : "s"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Rating</dt>
                  <dd className="text-neutral-300">
                    <Stars rating={offer.rating} />{" "}
                    <span className="text-xs text-neutral-500">
                      ({offer.reviewCount.toLocaleString()})
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Quantity</dt>
                  <dd className="text-neutral-300">{quantity}</dd>
                </div>
              </dl>
              {offer.reason ? (
                <p className="mt-2 text-sm italic text-neutral-500">
                  {offer.reason}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
