// ProcurePilot — Studio LLM proxy (POST /api/studio/llm).
//
// Server half of the Studio LLM adapter: one Studio "turn" -> one model call
// against the HuggingFace router. Mirrors the reference architecture of
// SarafuPay's /api/studio/llm (backend proxy behind the Studio Agent
// Framework): the future real AG Studio package posts conversation items
// here; today it serves the in-repo harness via lib/studio/hfChat.
//
// Body: { messages: StudioMessage[], tools?: StudioToolDef[], system?: string }
// Response: { text, toolCalls } or { error } — never throws.

import { NextResponse } from "next/server";
import { chatWithHf } from "@/lib/studio/hfChat";
import type { ChatRequest } from "@/lib/studio/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: "Body must include messages[]." }, { status: 400 });
  }
  try {
    const res = await chatWithHf({
      messages: body.messages,
      tools: Array.isArray(body.tools) ? body.tools : [],
      system: body.system,
    });
    if (res.error) {
      return NextResponse.json({ text: "", toolCalls: [], error: res.error }, { status: 200 });
    }
    return NextResponse.json({ text: res.text, toolCalls: res.toolCalls });
  } catch (err) {
    return NextResponse.json(
      { text: "", toolCalls: [], error: err instanceof Error ? err.message : String(err) },
      { status: 200 },
    );
  }
}
