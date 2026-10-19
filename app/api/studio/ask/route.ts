// ProcurePilot — Studio agent endpoint (POST /api/studio/ask).
//
// Runs one spend-analyst turn server-side: the harness calls the HF router,
// executes domain tools against the ledger/catalog, and returns the final
// answer plus the tool trace for the ChatUI.
//
// Body: { question: string, history?: StudioMessage[] }
// Response: { answer, trace, stepsUsed, degraded } — degraded=true when the
// LLM was unreachable (the deterministic anomaly data still renders).

import { NextResponse } from "next/server";
import { createAiHarness } from "@/lib/studio/types";
import { runAgentTurn } from "@/lib/studio/harness";
import { chatWithHf } from "@/lib/studio/hfChat";
import { spendAgent } from "@/lib/studio/spendAgent";
import type { StudioMessage } from "@/lib/studio/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: { question?: string; history?: StudioMessage[] };
  try {
    body = (await req.json()) as { question?: string; history?: StudioMessage[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const question = (body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "Body must include a non-empty question." }, { status: 400 });
  }
  if (question.length > 2000) {
    return NextResponse.json({ error: "Question too long (max 2000 chars)." }, { status: 400 });
  }
  const harness = createAiHarness(chatWithHf);
  try {
    const result = await runAgentTurn(harness, spendAgent, question, body.history ?? []);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        answer:
          "The analyst hit an unexpected error. The deterministic anomaly scan still works — check the anomaly alerts below.",
        trace: [],
        stepsUsed: 0,
        degraded: true,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 200 },
    );
  }
}
