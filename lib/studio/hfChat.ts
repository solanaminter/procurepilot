// ProcurePilot — LLM adapter for the Studio harness (OpenAI-compatible).
//
// Production ChatFn: one Studio turn -> one chat-completions call against an
// OpenAI-compatible endpoint. The endpoint and model are env-configurable:
//
//   STUDIO_LLM_BASE_URL  default https://router.huggingface.co/v1
//   STUDIO_LLM_MODEL     default meta-llama/Llama-3.1-8B-Instruct
//
// The HF router is the documented fallback. In practice the router returned
// 402 "no remaining credits", so the live setup points at the Modal-hosted
// vLLM endpoint (see infra/modal-llm/README.md):
//
//   STUDIO_LLM_BASE_URL=https://<modal-endpoint>/v1
//   STUDIO_LLM_MODEL=procurepilot-llm
//
// The key is read from LLM_API_KEY first, then ~/.cache/huggingface/token
// (same path the project already uses). vLLM ignores the key, so any
// non-empty value works there; for deployed environments prefer LLM_API_KEY.
//
// When the provider refuses (e.g. exhausted inference credits), the adapter
// returns a structured error instead of throwing, so the ChatUI degrades to
// a clear "LLM unavailable" state rather than crashing the turn.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type {
  ChatFn,
  ChatRequest,
  ChatResponse,
  StudioMessage,
  StudioToolDef,
} from "./types";

const BASE_URL =
  process.env.STUDIO_LLM_BASE_URL || "https://router.huggingface.co/v1";
const ROUTER_URL = `${BASE_URL.replace(/\/$/, "")}/chat/completions`;
const MODEL = process.env.STUDIO_LLM_MODEL || "meta-llama/Llama-3.1-8B-Instruct";

function readToken(): string | null {
  if (process.env.LLM_API_KEY) return process.env.LLM_API_KEY;
  try {
    const p = path.join(os.homedir(), ".cache", "huggingface", "token");
    const t = fs.readFileSync(p, "utf8").trim();
    return t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

function toOpenAiMessages(messages: StudioMessage[]): OpenAiMessage[] {
  const out: OpenAiMessage[] = [];
  for (const m of messages) {
    if (m.role === "tool") {
      for (const part of m.content) {
        if (part.type === "tool-result") {
          out.push({
            role: "tool",
            content: part.output,
            tool_call_id: part.toolCallId,
          });
        }
      }
      continue;
    }
    const texts = m.content
      .filter((p) => p.type === "text")
      .map((p) => (p as { text: string }).text);
    const calls = m.content.filter((p) => p.type === "tool-call");
    if (m.role === "assistant" && calls.length > 0) {
      out.push({
        role: "assistant",
        content: texts.join("\n") || null,
        tool_calls: calls.map((c) => {
          const tc = c as { toolCallId: string; toolName: string; input: Record<string, unknown> };
          return {
            id: tc.toolCallId,
            type: "function" as const,
            function: { name: tc.toolName, arguments: JSON.stringify(tc.input ?? {}) },
          };
        }),
      });
    } else if (texts.length > 0 || m.role === "system") {
      out.push({ role: m.role, content: texts.join("\n") });
    }
  }
  return out;
}

function toOpenAiTools(tools: StudioToolDef[]) {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

let toolCallSeq = 0;

export const chatWithHf: ChatFn = async (req: ChatRequest): Promise<ChatResponse> => {
  const token = readToken();
  if (!token) {
    return { text: "", toolCalls: [], error: "LLM_API_KEY / HF token not configured." };
  }
  const payload: Record<string, unknown> = {
    model: MODEL,
    messages: [
      ...(req.system ? [{ role: "system", content: req.system }] : []),
      ...toOpenAiMessages(req.messages),
    ],
    tools: toOpenAiTools(req.tools),
    tool_choice: "auto",
    max_tokens: 1024,
    temperature: 0.2,
  };
  let res: Response;
  try {
    res = await fetch(ROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { text: "", toolCalls: [], error: `LLM request failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint =
      res.status === 402 || /no remaining credits/i.test(body)
        ? " (inference credits exhausted — point STUDIO_LLM_BASE_URL at the Modal endpoint; see infra/modal-llm/README.md)"
        : "";
    return { text: "", toolCalls: [], error: `LLM provider returned ${res.status}${hint}` };
  }
  const data = (await res.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
      };
    }[];
  };
  const msg = data.choices?.[0]?.message;
  const toolCalls = (msg?.tool_calls ?? []).map((tc) => {
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(tc.function?.arguments ?? "{}") as Record<string, unknown>;
    } catch {
      input = {};
    }
    return {
      id: tc.id ?? `call-${++toolCallSeq}`,
      name: tc.function?.name ?? "unknown",
      input,
    };
  });
  return { text: msg?.content ?? "", toolCalls };
};
