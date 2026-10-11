// ProcurePilot — offer comparison / ranking (Phase 1).
//
// Pure function: filters offers against the intent's constraints, ranks the
// qualifiers by total landed cost (unit price × quantity + shipping), and
// reports savings vs. the "naive buy" (the most expensive qualifying offer).

import type {
  ComparisonResult,
  ProcurementIntent,
  ProductOffer,
  RankedOffer,
} from "./adapters/types";

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

export function compareOffers(
  offers: ProductOffer[],
  intent: ProcurementIntent,
): ComparisonResult {
  const qualifying = offers.filter(
    (o) =>
      o.inStock &&
      (intent.maxUnitPriceCents === undefined ||
        o.priceCents <= intent.maxUnitPriceCents) &&
      (intent.maxShippingEtaDays === undefined ||
        o.shippingEtaDays <= intent.maxShippingEtaDays),
  );

  if (qualifying.length === 0) {
    const constraints: string[] = [];
    if (intent.maxUnitPriceCents !== undefined) {
      constraints.push(`unit price ≤ ${formatCents(intent.maxUnitPriceCents)}`);
    }
    if (intent.maxShippingEtaDays !== undefined) {
      constraints.push(`delivery ≤ ${intent.maxShippingEtaDays} day(s)`);
    }
    throw new Error(
      `No offers qualify for "${intent.itemDescription}" ` +
        `(in stock${constraints.length > 0 ? ", " + constraints.join(", ") : ""}). ` +
        `Try relaxing the budget or delivery constraints.`,
    );
  }

  const withTotals = qualifying
    .map((offer) => ({
      offer,
      totalCents: offer.priceCents * intent.quantity + offer.shippingCents,
    }))
    .sort((a, b) => a.totalCents - b.totalCents);

  const best = withTotals[0];
  const priciest = withTotals[withTotals.length - 1];
  const fastestEta = Math.min(...withTotals.map((w) => w.offer.shippingEtaDays));

  const ranked: RankedOffer[] = withTotals.map((w, i) => {
    let reason: string;
    if (i === 0) {
      reason =
        "cheapest landed cost" +
        (w.offer.shippingEtaDays === fastestEta ? " · fastest delivery" : "");
    } else if (
      w.offer.shippingEtaDays === fastestEta &&
      fastestEta < best.offer.shippingEtaDays
    ) {
      reason = "fastest delivery under budget";
    } else {
      reason = `${ordinal(i + 1)} cheapest landed cost`;
    }
    return {
      ...w.offer,
      totalCents: w.totalCents,
      rank: i + 1,
      reason,
    };
  });

  // Savings vs. the "naive buy": the most expensive qualifying offer.
  const savingsCents = priciest.totalCents - best.totalCents;
  const savingsPct =
    priciest.totalCents > 0
      ? (savingsCents / priciest.totalCents) * 100
      : 0;

  const b = ranked[0];
  let summary =
    `Best pick: ${b.merchant} — "${b.title}" × ${intent.quantity}: ` +
    `${formatCents(b.totalCents)} landed (${formatCents(b.priceCents)}/unit + ` +
    `${formatCents(b.shippingCents)} shipping, ${b.shippingEtaDays}-day delivery). ` +
    `Compared ${ranked.length} qualifying offers; the priciest ("naive buy") would cost ` +
    `${formatCents(priciest.totalCents)} — you save ${formatCents(savingsCents)} ` +
    `(${savingsPct.toFixed(1)}%).`;
  if (intent.maxTotalCents !== undefined) {
    summary +=
      b.totalCents <= intent.maxTotalCents
        ? ` Within your ${formatCents(intent.maxTotalCents)} total budget.`
        : ` Over your ${formatCents(intent.maxTotalCents)} total budget — consider lowering the quantity.`;
  }

  return {
    ranked,
    best: ranked[0],
    savingsCents,
    savingsPct,
    summary,
  };
}
