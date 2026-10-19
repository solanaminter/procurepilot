// ProcurePilot — anomaly alerts endpoint (GET /api/studio/anomalies).
//
// Deterministic, no LLM involved: unusual order amounts, duplicate
// re-orders within 7 days, and supplier price spikes ≥15%. The Studio
// dashboard renders these as alert cards; the spend-analyst agent reads
// the same detector through its get_anomalies tool.

import { NextResponse } from "next/server";
import { detectAnomalies } from "@/lib/studio/anomalies";

export const dynamic = "force-dynamic";

export async function GET() {
  const anomalies = detectAnomalies();
  return NextResponse.json({
    count: anomalies.length,
    byKind: {
      unusual_amount: anomalies.filter((a) => a.kind === "unusual_amount").length,
      duplicate_order: anomalies.filter((a) => a.kind === "duplicate_order").length,
      price_spike: anomalies.filter((a) => a.kind === "price_spike").length,
    },
    anomalies: anomalies.map((a) => ({
      id: a.id,
      kind: a.kind,
      severity: a.severity,
      orderId: a.orderId,
      title: a.title,
      detail: a.detail,
      createdAt: a.createdAt,
      totalCents: a.totalCents,
    })),
  });
}
