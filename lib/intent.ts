// ProcurePilot — procurement intent parsing (Phase 1).
//
// Two paths:
//   - parseIntentMock: deterministic keyword parser over the mock catalog.
//     No network, no credentials. Used whenever MOCK_MODE is on.
//   - parseIntentLLM: structured-output extraction via a real model
//     (generateObject). Used when MOCK_MODE=false and LLM_API_KEY is set.
//
// ── Catalog-unit normalization (mock parser) ────────────────────────────
// The mock catalog prices offers per pack/case (e.g. $17.49 per 25-pack of
// shipping boxes), but people talk in individual units ("200 boxes",
// "under $1.20/unit" = per box). The parser normalizes both quantity and
// per-unit budgets into catalog offer units (200 boxes → 8 packs;
// ≤$1.20/box → ≤$30.00/pack) so the downstream compareOffers formula and the
// Channel3 search call work unchanged. The raw request is preserved in
// `notes` for transparency.

import { z } from "zod";
import { generateObject, type LanguageModel } from "ai";
import type { ProcurementIntent } from "./adapters/types";

// Zod schema mirrors ProcurementIntent in lib/adapters/types.ts exactly.
export const procurementIntentSchema = z.object({
  itemDescription: z.string().min(1),
  quantity: z.number().int().min(1),
  maxUnitPriceCents: z.number().int().positive().optional(),
  maxTotalCents: z.number().int().positive().optional(),
  maxShippingEtaDays: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export type ParsedIntent = z.infer<typeof procurementIntentSchema>;

// ─── Catalog product table ──────────────────────────────────────────────
// pattern: matched against the raw message (first hit wins — order matters).
// query: canonical Channel3 search query for the product.
// packSize: individual units per catalog offer (pack/case/count).
// unitNoun: singular noun for one individual unit.

interface ProductSpec {
  pattern: RegExp;
  query: string;
  packSize: number;
  unitNoun: string;
}

const PRODUCTS: ProductSpec[] = [
  { pattern: /shipping\s*box|matte\s*box|cardboard\s*box/i, query: "matte shipping boxes 10x8x6", packSize: 25, unitNoun: "box" },
  { pattern: /poly\s*mailer|mailer/i, query: "poly mailers", packSize: 100, unitNoun: "mailer" },
  { pattern: /packing\s*tape|\btape\b/i, query: "packing tape", packSize: 6, unitNoun: "roll" },
  { pattern: /bubble\s*wrap/i, query: "bubble wrap", packSize: 1, unitNoun: "roll" },
  { pattern: /label/i, query: "shipping labels", packSize: 500, unitNoun: "label" },
  { pattern: /paper\s*towel/i, query: "paper towels", packSize: 12, unitNoun: "roll" },
  { pattern: /\ba4\b|copy\s*paper|printer\s*paper/i, query: "A4 paper", packSize: 10, unitNoun: "ream" },
  { pattern: /\bpen\b/i, query: "ballpoint pens", packSize: 60, unitNoun: "pen" },
  { pattern: /notebook/i, query: "spiral notebooks", packSize: 12, unitNoun: "notebook" },
  { pattern: /toner|cartridge/i, query: "laser toner", packSize: 1, unitNoun: "cartridge" },
  { pattern: /sanitiz|disinfect/i, query: "sanitizer spray", packSize: 4, unitNoun: "bottle" },
  { pattern: /hand\s*soap|\bsoap\b/i, query: "hand soap", packSize: 6, unitNoun: "bottle" },
  { pattern: /trash\s*bag|garbage\s*bag/i, query: "trash bags", packSize: 110, unitNoun: "bag" },
  { pattern: /coffee\s*pod/i, query: "coffee pods", packSize: 96, unitNoun: "pod" },
  { pattern: /hot\s*cup|paper\s*cup/i, query: "paper hot cups", packSize: 500, unitNoun: "cup" },
  // Vague restock requests ("running low on cleaning supplies"): search the
  // whole cleaning category; no unit normalization possible.
  { pattern: /cleaning|janitorial/i, query: "cleaning", packSize: 1, unitNoun: "item" },
];

const FILLER_WORDS =
  /\b(we'?re|we are|running low on|need|needs|order|buy|buying|get|getting|please|some|the|a|an|for|our|us|i want|we want|looking for|stock up on|restock)\b/gi;

function fallbackDescription(message: string): string {
  const cleaned = message
    .replace(/\$[\d.]+\s*\/\s*\w+/gi, " ")
    .replace(/under\s+\$[\d.]+/gi, " ")
    .replace(/\d+\s*-?\s*days?/gi, " ")
    .replace(/\b(fast|two-day|2-day)\b/gi, " ")
    .replace(FILLER_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || message.trim();
}

function plural(noun: string, n: number): string {
  return n === 1 ? noun : `${noun}s`;
}

export function parseIntentMock(message: string): ProcurementIntent {
  const msg = message.trim();
  const spec = PRODUCTS.find((p) => p.pattern.test(msg));
  const packSize = spec?.packSize ?? 1;
  const notes: string[] = [];

  // Quantity: /(\d+)\s*(units|boxes|reams|packs|bottles|rolls|cases|count)?/i, default 1.
  const qm = msg.match(/(\d+)\s*(units|boxes|reams|packs|bottles|rolls|cases|count)?/i);
  const rawQty = qm ? parseInt(qm[1], 10) : 1;
  const quantity = Math.max(1, Math.ceil(rawQty / packSize));
  if (spec && packSize > 1 && quantity !== rawQty) {
    notes.push(
      `Requested ${rawQty} ${plural(spec.unitNoun, rawQty)} → ${quantity} × ${packSize}-pack (catalog sells per pack)`,
    );
  }

  // Per-unit budget: /\$([\d.]+)\s*\/\s*unit/i → cents. Denominator extended to
  // each/pack/case; pack/case denominators are already in offer units and are
  // not scaled, per-individual-unit ones are scaled by packSize.
  let maxUnitPriceCents: number | undefined;
  const um = msg.match(/\$([\d.]+)\s*\/\s*(unit|each|pack|case)s?\b/i);
  if (um) {
    const cents = Math.round(parseFloat(um[1]) * 100);
    const denom = um[2].toLowerCase();
    const scaled = denom === "pack" || denom === "case" ? cents : cents * packSize;
    maxUnitPriceCents = scaled;
    if (scaled !== cents) {
      notes.push(`Budget ${um[0]} → ≤ $${(scaled / 100).toFixed(2)}/pack`);
    }
  }

  // Total budget: /under \$([\d.]+)(?!\s*\/)/i → cents. Skipped when a
  // per-unit budget is present — otherwise regex backtracking misreads
  // "under $1.20/unit" as a $1.20 total.
  let maxTotalCents: number | undefined;
  if (!um) {
    const tm = msg.match(/under\s+\$([\d.]+)(?!\s*\/)/i);
    if (tm) {
      maxTotalCents = Math.round(parseFloat(tm[1]) * 100);
    }
  }

  // Shipping: /(\d+)\s*-?\s*day/i, or /fast|2-day|two-day/i → 2 days.
  let maxShippingEtaDays: number | undefined;
  const sm = msg.match(/(\d+)\s*-?\s*day/i);
  if (sm) {
    maxShippingEtaDays = parseInt(sm[1], 10);
  } else if (/fast|2-day|two-day/i.test(msg)) {
    maxShippingEtaDays = 2;
  }

  const itemDescription = spec ? spec.query : fallbackDescription(msg);

  return {
    itemDescription,
    quantity,
    maxUnitPriceCents,
    maxTotalCents,
    maxShippingEtaDays,
    notes: notes.length > 0 ? notes.join("; ") : undefined,
  };
}

const INTENT_SYSTEM_PROMPT = `You are a procurement assistant. Extract the buyer's procurement intent from their message.
- itemDescription: concise product description for catalog search (e.g. "matte shipping boxes 10x8x6", "A4 copy paper").
- quantity: number of catalog offer units (packs/cases) to buy, minimum 1. If the buyer states individual units (e.g. "200 boxes" of a 25-pack product), convert to whole packs rounded up.
- maxUnitPriceCents: per-OFFER-unit budget cap in cents, if stated (e.g. "$1.20/unit" for a 25-pack product means 3000 cents per pack). Omit if not stated.
- maxTotalCents: total order budget cap in cents, if stated ("under $300"). Omit if not stated.
- maxShippingEtaDays: delivery deadline in days, if stated ("2-day", "fast" = 2). Omit if not stated.
- notes: brief note if you normalized units/budgets.`;

export async function parseIntentLLM(
  message: string,
  model: LanguageModel,
): Promise<ProcurementIntent> {
  const { object } = await generateObject({
    model,
    schema: procurementIntentSchema,
    system: INTENT_SYSTEM_PROMPT,
    prompt: `Extract the procurement intent from this buyer message:\n\n${message}`,
  });
  return object;
}
