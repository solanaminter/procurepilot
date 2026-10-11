// ProcurePilot — real-product catalog adapter (Channel3 route-around).
//
// Channel3's signup is gated behind a Cloudflare challenge that will not
// clear, so when MOCK_MODE is false and no CHANNEL3_API_KEY is set,
// getChannel3() returns this adapter instead of the (still unimplemented)
// Channel3 HTTP adapter. It searches a curated dataset of REAL products
// (./catalog-data.ts): real brands, models, retailers, and realistic Oct-2026
// street prices. No network calls, no credentials.
//
// Query semantics mirror the mock adapter: AND over whitespace-separated
// tokens against title + keywords, with light plural/synonym normalization.
// Ranking is deterministic: total landed cost (price + shipping) ascending,
// ties broken by offer id.

import type {
  Channel3Adapter,
  ProductOffer,
  ProductSearchQuery,
} from "./types";
import { REAL_CATALOG } from "./catalog-data";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// Plural / synonym normalization applied to query tokens only.
const TOKEN_ALIASES: Record<string, string> = {
  mice: "mouse",
  keyboards: "keyboard",
  keypads: "keypad",
  desks: "desk",
  chairs: "chair",
  laptops: "laptop",
  notebooks: "notebook",
  monitors: "monitor",
  screens: "screen",
  webcams: "webcam",
  cameras: "camera",
  headphones: "headphone",
  headsets: "headset",
  earbuds: "earbud",
  hubs: "hub",
  docks: "dock",
  docking: "dock",
  bottles: "bottle",
  backpacks: "backpack",
  ssds: "ssd",
  drives: "drive",
  lamps: "lamp",
};

function normalizeToken(token: string): string {
  const lower = token.toLowerCase();
  return TOKEN_ALIASES[lower] ?? lower;
}

function matchesQuery(
  entry: { title: string; keywords: string },
  query: string,
): boolean {
  const haystack = `${entry.title} ${entry.keywords}`.toLowerCase();
  const tokens = query
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeToken);
  if (tokens.length === 0) return true;
  return tokens.every((t) => haystack.includes(t));
}

function toOffer(entry: (typeof REAL_CATALOG)[number]): ProductOffer {
  const { bucket: _bucket, keywords: _keywords, ...offer } = entry;
  return offer;
}

export class RealCatalogAdapter implements Channel3Adapter {
  async searchProducts(q: ProductSearchQuery): Promise<ProductOffer[]> {
    await delay(150); // light simulated latency, like the mock adapter

    let offers = REAL_CATALOG.filter((e) => matchesQuery(e, q.query)).map(toOffer);

    const { maxPriceCents, maxShippingEtaDays, limit } = q;

    if (maxPriceCents !== undefined) {
      offers = offers.filter((o) => o.priceCents <= maxPriceCents);
    }
    if (maxShippingEtaDays !== undefined) {
      offers = offers.filter((o) => o.shippingEtaDays <= maxShippingEtaDays);
    }

    // Deterministic ranking: total landed cost ascending, id tiebreak.
    offers.sort(
      (a, b) =>
        a.priceCents + a.shippingCents - (b.priceCents + b.shippingCents) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );

    if (limit !== undefined && limit >= 0) {
      offers = offers.slice(0, limit);
    }

    return offers;
  }
}

// ─── Dashboard support (additive) ────────────────────────────────────────
// Maps a real-catalog offer id back to its spend bucket. The ledger's
// offerBucket (mock-channel3) falls back to "General" for unknown ids; wire
// this in there if dashboard bucketing should distinguish real-catalog
// categories. Additive only — nothing existing is changed.
const BUCKET_BY_ID = new Map<string, string>(
  REAL_CATALOG.map((e) => [e.id, e.bucket] as const),
);

export function realOfferBucket(offerId: string): string {
  return BUCKET_BY_ID.get(offerId) ?? "General";
}
