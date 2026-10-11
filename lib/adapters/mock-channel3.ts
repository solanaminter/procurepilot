// ProcurePilot — mock Channel3 product-catalog adapter (Phase 1).
// In-memory catalog of fictional merchants and offers. Simulates latency and
// supports keyword search + price/ETA filters. No network calls, no credentials.
//
// Real adapter (Phase 2) will POST to https://api.trychannel3.com/v1/search
// with the CHANNEL3_API_KEY in an `x-api-key` header.

import type {
  Channel3Adapter,
  ProductOffer,
  ProductSearchQuery,
} from "./types";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// ─── Offer factory ─────────────────────────────────────────────────────────
// All merchant names are fictional, invented for this mock catalog.

type OfferSpec = [
  merchant: string,
  priceCents: number,
  shippingCents: number,
  etaDays: number,
  rating: number,
  reviewCount: number,
  inStock?: boolean,
];

interface CatalogProduct {
  idPrefix: string;
  title: string;
  category: string; // searchable keyword bucket
  offers: OfferSpec[];
}

function expand(product: CatalogProduct): ProductOffer[] {
  return product.offers.map(
    ([merchant, priceCents, shippingCents, etaDays, rating, reviewCount, inStock], i) => ({
      id: `${product.idPrefix}-${i + 1}`,
      title: product.title,
      merchant,
      priceCents,
      currency: "USD" as const,
      shippingCents,
      shippingEtaDays: etaDays,
      rating,
      reviewCount,
      inStock: inStock ?? true,
      productUrl: `https://catalog.mock.procurepilot/${product.idPrefix}/${i + 1}`,
    }),
  );
}

const CATALOG: CatalogProduct[] = [
  // ── Packaging supplies ────────────────────────────────────────────────
  {
    idPrefix: "box-matte-10x8x6",
    title: "Matte Shipping Boxes 10x8x6 (25-pack)",
    category: "packaging supplies shipping boxes mailers cardboard",
    offers: [
      ["Packlane", 2299, 0, 2, 4.7, 1284],
      ["ShipWell", 2149, 495, 3, 4.4, 863],
      ["BoxCraft", 2599, 0, 1, 4.8, 542],
      ["SupplyNest", 1899, 695, 5, 3.9, 311],
      ["BulkMart", 1749, 995, 7, 3.5, 187],
      ["ValueShip", 3499, 0, 2, 3.2, 64], // overpriced edge case
    ],
  },
  {
    idPrefix: "poly-mailer-10x13",
    title: "Poly Mailers 10x13 (100-pack)",
    category: "packaging supplies shipping mailers envelopes",
    offers: [
      ["ShipWell", 1499, 0, 2, 4.6, 2103],
      ["Packlane", 1649, 0, 3, 4.5, 1478],
      ["BoxCraft", 1799, 299, 1, 4.9, 966],
      ["SupplyNest", 1299, 595, 4, 4.1, 689],
      ["BulkMart", 1149, 895, 6, 3.6, 254],
    ],
  },
  {
    idPrefix: "packing-tape-hd",
    title: "Heavy-Duty Packing Tape 2in (6-pack)",
    category: "packaging supplies shipping tape adhesive",
    offers: [
      ["Packlane", 1899, 0, 2, 4.7, 1932],
      ["ShipWell", 1799, 295, 3, 4.3, 1105],
      ["BoxCraft", 2099, 0, 1, 4.8, 774],
      ["OfficeHub", 1699, 495, 4, 4.0, 432, false], // out-of-stock edge case
      ["ValueShip", 2899, 0, 2, 3.4, 98], // overpriced edge case
    ],
  },
  {
    idPrefix: "bubble-wrap-12x100",
    title: "Bubble Wrap Roll 12in x 100ft",
    category: "packaging supplies shipping wrap cushioning protective",
    offers: [
      ["BoxCraft", 2199, 0, 2, 4.6, 1208],
      ["Packlane", 1999, 495, 3, 4.4, 893],
      ["SupplyNest", 1849, 695, 5, 4.0, 517],
      ["BulkMart", 1599, 1295, 7, 3.3, 143], // slow-shipping edge case
      ["ShipWell", 2299, 0, 1, 4.5, 661],
    ],
  },
  {
    idPrefix: "ship-labels-2x4",
    title: "Self-Adhesive Shipping Labels 2x4in (500-pack)",
    category: "packaging supplies shipping labels stickers printer",
    offers: [
      ["OfficeHub", 1399, 0, 2, 4.5, 1566],
      ["ShipWell", 1299, 295, 3, 4.2, 902],
      ["Packlane", 1499, 0, 2, 4.6, 1140],
      ["SupplyNest", 1149, 595, 5, 3.8, 366],
      ["BulkMart", 999, 995, 7, 3.2, 129], // slow-shipping edge case
    ],
  },

  // ── Office supplies ───────────────────────────────────────────────────
  {
    idPrefix: "paper-a4-10ream",
    title: "A4 Copy Paper 80gsm (10 reams x 500 sheets)",
    category: "office supplies paper printer copy",
    offers: [
      ["OfficeHub", 5499, 0, 2, 4.7, 3421],
      ["SupplyNest", 5199, 0, 3, 4.4, 1876],
      ["DeskLine", 5699, 0, 1, 4.8, 1204],
      ["BulkMart", 4799, 1295, 6, 3.7, 845],
      ["ValueShip", 7999, 0, 3, 3.5, 210], // overpriced edge case
    ],
  },
  {
    idPrefix: "pen-ballpoint-60",
    title: "Ballpoint Pens Medium Point (60-pack)",
    category: "office supplies pens writing stationery",
    offers: [
      ["OfficeHub", 1199, 0, 2, 4.6, 2744],
      ["DeskLine", 1349, 0, 1, 4.9, 1590],
      ["SupplyNest", 999, 395, 3, 4.1, 983],
      ["ShipWell", 1099, 295, 4, 4.0, 517],
      ["ValueShip", 2199, 0, 2, 3.2, 88], // overpriced edge case
    ],
  },
  {
    idPrefix: "notebook-spiral-12",
    title: "Spiral Notebooks College Ruled (12-pack)",
    category: "office supplies notebooks writing stationery paper",
    offers: [
      ["OfficeHub", 2399, 0, 2, 4.5, 1876],
      ["DeskLine", 2599, 0, 1, 4.7, 1102],
      ["SupplyNest", 2199, 495, 3, 4.2, 764],
      ["BulkMart", 1999, 895, 6, 3.6, 342],
      ["StorePlus", 2349, 0, 3, 4.3, 488],
    ],
  },
  {
    idPrefix: "toner-laser-black",
    title: "Laser Toner Cartridge Black (high yield)",
    category: "office supplies toner printer ink cartridge",
    offers: [
      ["OfficeHub", 8999, 0, 2, 4.6, 1304],
      ["DeskLine", 9499, 0, 1, 4.8, 876],
      ["SupplyNest", 8499, 495, 3, 4.3, 692],
      ["PrimeStock", 7999, 695, 4, 4.0, 418, false], // out-of-stock edge case
      ["ValueShip", 13999, 0, 2, 3.4, 76], // overpriced edge case
    ],
  },

  // ── Cleaning / janitorial ─────────────────────────────────────────────
  {
    idPrefix: "sanitizer-4pk",
    title: "Surface Sanitizer Spray (4-pack, 32oz)",
    category: "cleaning janitorial sanitizer spray disinfect office",
    offers: [
      ["CleanPro", 1899, 0, 2, 4.7, 2210],
      ["SupplyNest", 1749, 495, 3, 4.4, 1345],
      ["OfficeHub", 1999, 0, 2, 4.5, 1098],
      ["BulkMart", 1549, 995, 6, 3.8, 567],
      ["StorePlus", 1849, 295, 3, 4.1, 723],
    ],
  },
  {
    idPrefix: "paper-towels-12pk",
    title: "Paper Towels 2-Ply (12-pack)",
    category: "cleaning janitorial paper towels office kitchen",
    offers: [
      ["CleanPro", 2299, 0, 2, 4.6, 1893],
      ["SupplyNest", 2149, 0, 3, 4.3, 1276],
      ["BulkMart", 1899, 995, 5, 3.9, 804],
      ["StorePlus", 2249, 295, 3, 4.2, 615],
      ["OfficeHub", 2399, 0, 1, 4.7, 958],
    ],
  },
  {
    idPrefix: "hand-soap-foam-6pk",
    title: "Foaming Hand Soap Refill (6-pack, 1L)",
    category: "cleaning janitorial hand soap restroom office",
    offers: [
      ["CleanPro", 2799, 0, 2, 4.8, 1543],
      ["SupplyNest", 2599, 495, 3, 4.4, 921],
      ["PrimeStock", 2499, 695, 4, 4.2, 587, false], // out-of-stock edge case
      ["BulkMart", 2299, 995, 7, 3.5, 289], // slow-shipping edge case
      ["OfficeHub", 2899, 0, 2, 4.5, 703],
    ],
  },
  {
    idPrefix: "trash-bags-tall-110",
    title: "Tall Kitchen Trash Bags 13gal (110-pack)",
    category: "cleaning janitorial trash bags waste office",
    offers: [
      ["CleanPro", 1999, 0, 2, 4.6, 1765],
      ["SupplyNest", 1849, 495, 3, 4.3, 1089],
      ["BulkMart", 1599, 1195, 7, 3.4, 412], // slow-shipping edge case
      ["StorePlus", 1949, 295, 4, 4.1, 530],
      ["OfficeHub", 2099, 0, 1, 4.7, 812],
    ],
  },

  // ── Breakroom ─────────────────────────────────────────────────────────
  {
    idPrefix: "coffee-pods-96",
    title: "Coffee Pods Medium Roast (96-count)",
    category: "breakroom coffee pods kitchen beverages",
    offers: [
      ["BrewBox", 4499, 0, 2, 4.7, 2451],
      ["SupplyNest", 4299, 495, 3, 4.4, 1620],
      ["StorePlus", 4199, 295, 3, 4.3, 987],
      ["BulkMart", 3899, 995, 6, 3.8, 743],
      ["PrimeStock", 5999, 0, 1, 3.6, 154], // overpriced edge case
    ],
  },
  {
    idPrefix: "paper-cups-12oz-500",
    title: "Paper Hot Cups 12oz (500-pack)",
    category: "breakroom coffee cups kitchen beverages paper",
    offers: [
      ["BrewBox", 3499, 0, 2, 4.6, 1318],
      ["SupplyNest", 3299, 495, 3, 4.3, 876],
      ["CleanPro", 3599, 0, 2, 4.5, 694],
      ["BulkMart", 2999, 995, 7, 3.7, 358], // slow-shipping edge case
      ["StorePlus", 3449, 295, 3, 4.2, 502],
    ],
  },
];

function matchesQuery(product: CatalogProduct, query: string): boolean {
  const haystack = `${product.title} ${product.category}`.toLowerCase();
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  // ALL tokens must appear (AND semantics); plurals handled loosely.
  return tokens.every((t) => haystack.includes(t));
}

export const mockChannel3: Channel3Adapter = {
  async searchProducts(q: ProductSearchQuery): Promise<ProductOffer[]> {
    await delay(150); // simulate network latency

    let offers = CATALOG.filter((p) => matchesQuery(p, q.query)).flatMap(expand);

    const { maxPriceCents, maxShippingEtaDays, limit } = q;

    if (maxPriceCents !== undefined) {
      offers = offers.filter((o) => o.priceCents <= maxPriceCents);
    }
    if (maxShippingEtaDays !== undefined) {
      offers = offers.filter((o) => o.shippingEtaDays <= maxShippingEtaDays);
    }

    // Rank by total landed cost (unit price + shipping), cheapest first.
    offers.sort((a, b) => a.priceCents + a.shippingCents - (b.priceCents + b.shippingCents));

    if (limit !== undefined && limit >= 0) {
      offers = offers.slice(0, limit);
    }

    return offers;
  },
};

// ─── Dashboard support (additive) ────────────────────────────────────────
// Maps an offer id (e.g. "box-matte-10x8x6-3") back to its display bucket
// ("Packaging" | "Office" | "Cleaning" | "Breakroom"), derived from the
// catalog's keyword category. Used by the merchant dashboard's spend
// analytics; the catalog itself is untouched.
const BUCKET_BY_PREFIX = new Map<string, string>(
  CATALOG.map((p) => {
    const first = p.category.split(" ")[0];
    const bucket =
      first === "packaging"
        ? "Packaging"
        : first === "office"
          ? "Office"
          : first === "cleaning"
            ? "Cleaning"
            : first === "breakroom"
              ? "Breakroom"
              : "General";
    return [p.idPrefix, bucket] as const;
  }),
);

export function offerBucket(offerId: string): string {
  const prefix = offerId.replace(/-\d+$/, "");
  return BUCKET_BY_PREFIX.get(prefix) ?? "General";
}
