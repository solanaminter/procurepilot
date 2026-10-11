// ProcurePilot — conversational orchestration endpoint (Phase 1).
//
// POST { messages: [{ role, content }] } → SSE stream of UI-message chunks
// consumable by the AI SDK's useChat.
//
// Pipeline:
//   1. Parse ProcurementIntent from the last user message
//      (mock keyword parser in mock mode, generateObject otherwise).
//   2. Channel3 product search with the intent's constraints.
//   3. compareOffers → ranked comparison (throws → graceful "no offers" reply).
//   4. Stream data parts `intent`, `offers`, `comparison`, `orderProposal`
//      (these exact part names are the UI contract), then a text summary —
//      canned in mock mode, streamed from the real model otherwise.

import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import { getChannel3, isMockMode } from "@/lib/adapters";
import { compareOffers, formatCents } from "@/lib/compare";
import { parseIntentLLM, parseIntentMock } from "@/lib/intent";
import { getModel } from "@/lib/llm";
import type {
  ComparisonResult,
  OrderLine,
  ProcurementIntent,
  ProductOffer,
} from "@/lib/adapters/types";

export const maxDuration = 60;

// ─── UI message contract ────────────────────────────────────────────────
// Data part names are the teammate-facing contract — do not rename.
export interface OrderProposalData {
  lines: OrderLine[];
  totalCents: number;
}

export type ProcurePilotDataParts = {
  intent: ProcurementIntent;
  offers: ProductOffer[];
  comparison: ComparisonResult;
  orderProposal: OrderProposalData;
};

export type ProcurePilotUIMessage = UIMessage<unknown, ProcurePilotDataParts>;

// ─── Helpers ────────────────────────────────────────────────────────────

// Accepts plain { role, content: string } messages as well as SDK UIMessages
// whose content is an array of parts.
function messageText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (p): p is { type: string; text: string } =>
          !!p &&
          typeof p === "object" &&
          (p as { type?: unknown }).type === "text" &&
          typeof (p as { text?: unknown }).text === "string",
      )
      .map((p) => p.text)
      .join("\n");
  }
  return "";
}

function cannedSummary(
  intent: ProcurementIntent,
  offers: ProductOffer[],
  comparison: ComparisonResult | null,
  comparisonError: string | null,
): string {
  if (!comparison || comparisonError) {
    return (
      `I searched for "${intent.itemDescription}" and found ${offers.length} offer(s), ` +
      `but ${comparisonError ?? "none of them met your constraints"}. ` +
      `Try relaxing the budget or delivery window and I'll re-run the comparison.`
    );
  }
  const b = comparison.best;
  const priciest = comparison.ranked[comparison.ranked.length - 1];
  const lines = [
    `Here's what I found for "${intent.itemDescription}" (quantity: ${intent.quantity}):`,
    ``,
    `Best pick: ${b.merchant} — ${b.title}`,
    `Landed cost: ${formatCents(b.totalCents)} (${formatCents(b.priceCents)}/unit × ${intent.quantity} + ${formatCents(b.shippingCents)} shipping, ${b.shippingEtaDays}-day delivery).`,
    `I compared ${comparison.ranked.length} qualifying offers — the priciest would have cost ${formatCents(priciest.totalCents)}, so you save ${formatCents(comparison.savingsCents)} (${comparison.savingsPct.toFixed(1)}%).`,
  ];
  if (intent.maxTotalCents !== undefined) {
    lines.push(
      b.totalCents <= intent.maxTotalCents
        ? `That's within your ${formatCents(intent.maxTotalCents)} total budget.`
        : `Note: that's over your ${formatCents(intent.maxTotalCents)} total budget.`,
    );
  }
  if (intent.notes) {
    lines.push(`(${intent.notes})`);
  }
  lines.push(``, `I've prepared an order proposal below — confirm and I'll create the PayPal order.`);
  return lines.join("\n");
}

const ANALYST_SYSTEM_PROMPT = `You are ProcurePilot, a conversational AI procurement agent. You have already searched the catalog and ranked the offers. Summarize the result for the buyer in a short, plain-spoken message: name the best pick (merchant, title, landed cost, delivery ETA), how many offers you compared, the savings vs the priciest qualifying option, and whether it fits their stated budget. End by asking them to confirm the order proposal. Do not invent offers or prices — use only the data provided.`;

function buildAnalysisPrompt(
  intent: ProcurementIntent,
  offers: ProductOffer[],
  comparison: ComparisonResult | null,
  comparisonError: string | null,
): string {
  return [
    `Buyer intent: ${JSON.stringify(intent)}`,
    `Offers returned by catalog search: ${JSON.stringify(offers)}`,
    comparison
      ? `Comparison result: ${JSON.stringify(comparison)}`
      : `Comparison failed: ${comparisonError}`,
    `Write the summary message to the buyer.`,
  ].join("\n\n");
}

// ─── Route ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: { messages?: unknown };
  try {
    body = (await req.json()) as { messages?: unknown };
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const lastUser = [...messages].reverse().find(
    (m) => !!m && typeof m === "object" && (m as { role?: unknown }).role === "user",
  );
  const text = messageText(lastUser).trim();
  if (!text) {
    return Response.json(
      { error: "No user message found in `messages`." },
      { status: 400 },
    );
  }

  const mock = isMockMode();
  let intent: ProcurementIntent;
  try {
    intent = mock ? parseIntentMock(text) : await parseIntentLLM(text, getModel());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Intent parsing failed." },
      { status: 500 },
    );
  }

  let offers: ProductOffer[];
  try {
    offers = await getChannel3().searchProducts({
      query: intent.itemDescription,
      maxPriceCents: intent.maxUnitPriceCents,
      maxShippingEtaDays: intent.maxShippingEtaDays,
      limit: 8,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Product search failed." },
      { status: 502 },
    );
  }

  let comparison: ComparisonResult | null = null;
  let comparisonError: string | null = null;
  try {
    comparison = compareOffers(offers, intent);
  } catch (err) {
    comparisonError = err instanceof Error ? err.message : String(err);
  }

  const stream = createUIMessageStream<ProcurePilotUIMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "data-intent", data: intent });
      writer.write({ type: "data-offers", data: offers });

      if (comparison) {
        writer.write({ type: "data-comparison", data: comparison });
        const lines: OrderLine[] = [
          {
            offerId: comparison.best.id,
            title: comparison.best.title,
            merchant: comparison.best.merchant,
            quantity: intent.quantity,
            unitPriceCents: comparison.best.priceCents,
            shippingCents: comparison.best.shippingCents,
          },
        ];
        const totalCents = lines.reduce(
          (sum, l) => sum + l.unitPriceCents * l.quantity + l.shippingCents,
          0,
        );
        writer.write({ type: "data-orderProposal", data: { lines, totalCents } });
      }

      if (mock) {
        const summary = cannedSummary(intent, offers, comparison, comparisonError);
        writer.write({ type: "text-start", id: "summary" });
        for (let i = 0; i < summary.length; i += 160) {
          writer.write({
            type: "text-delta",
            id: "summary",
            delta: summary.slice(i, i + 160),
          });
        }
        writer.write({ type: "text-end", id: "summary" });
      } else {
        const result = streamText({
          model: getModel(),
          system: ANALYST_SYSTEM_PROMPT,
          prompt: buildAnalysisPrompt(intent, offers, comparison, comparisonError),
        });
        writer.merge(result.toUIMessageStream<ProcurePilotUIMessage>());
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
