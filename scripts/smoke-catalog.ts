// ProcurePilot — smoke test for the real-product catalog route-around.
// Exercises RealCatalogAdapter directly AND the getChannel3() factory path
// with MOCK_MODE=false (no CHANNEL3_API_KEY set).
// Usage: npx tsx scripts/smoke-catalog.ts

import { RealCatalogAdapter } from "../lib/adapters/real-catalog";
import { getChannel3 } from "../lib/adapters";
import { bucketCounts, REAL_CATALOG } from "../lib/adapters/catalog-data";
import type { ProductOffer, ProductSearchQuery } from "../lib/adapters/types";

function fmt(o: ProductOffer): string {
  const landed = (o.priceCents + o.shippingCents) / 100;
  const ship =
    o.shippingCents === 0 ? "free ship" : `+$${(o.shippingCents / 100).toFixed(2)} ship`;
  return (
    `  $${(o.priceCents / 100).toFixed(2)} (${ship}, ${o.shippingEtaDays}d) ` +
    `[${o.merchant}] ${o.title} — ${o.rating}★ ${o.reviewCount} reviews ` +
    `${o.inStock ? "in stock" : "OUT OF STOCK"} (landed $${landed.toFixed(2)})`
  );
}

async function runSearches(label: string, search: (q: ProductSearchQuery) => Promise<ProductOffer[]>) {
  console.log(`\n=== ${label} ===`);
  const cases: ProductSearchQuery[] = [
    { query: "standing desk", maxPriceCents: 30000, limit: 5 },
    { query: "wireless keyboard", limit: 5 },
    { query: "noise cancelling headphones", limit: 5 },
    { query: "laptop", maxPriceCents: 120000, limit: 5 },
    { query: "mice", limit: 3 },
    { query: "webcam", maxShippingEtaDays: 2, limit: 4 },
  ];
  for (const c of cases) {
    const offers = await search(c);
    const priceFilter = c.maxPriceCents !== undefined ? ` ≤$${(c.maxPriceCents / 100).toFixed(0)}` : "";
    const etaFilter = c.maxShippingEtaDays !== undefined ? ` ≤${c.maxShippingEtaDays}d` : "";
    console.log(`\n"${c.query}"${priceFilter}${etaFilter} → ${offers.length} offer(s)`);
    for (const o of offers) console.log(fmt(o));
    // Determinism check: re-run and compare ids.
    const again = await search(c);
    const same =
      JSON.stringify(offers.map((o) => o.id)) === JSON.stringify(again.map((o) => o.id));
    console.log(`  deterministic: ${same ? "yes" : "NO — RANKING CHANGED"}`);
  }
}

async function main() {
  const adapter = new RealCatalogAdapter();
  await runSearches("RealCatalogAdapter (direct)", (q) => adapter.searchProducts(q));

  // Factory path: MOCK_MODE=false, no CHANNEL3_API_KEY.
  process.env.MOCK_MODE = "false";
  delete process.env.CHANNEL3_API_KEY;
  const viaFactory = getChannel3();
  console.log(`\nfactory returned: ${viaFactory.constructor.name}`);
  await runSearches("getChannel3() with MOCK_MODE=false", (q) => viaFactory.searchProducts(q));

  // Catalog stats.
  console.log("\n=== catalog stats ===");
  console.log(`total offers: ${REAL_CATALOG.length}`);
  const counts = bucketCounts();
  for (const [bucket, n] of Object.entries(counts).sort()) {
    console.log(`  ${bucket}: ${n}`);
  }
  const uniqueProducts = new Set(REAL_CATALOG.map((e) => e.title)).size;
  console.log(`unique products: ${uniqueProducts}`);
}

main().catch((err) => {
  console.error("smoke failed:", err);
  process.exit(1);
});
