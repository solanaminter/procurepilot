// ProcurePilot — Studio agent framework types.
//
// Mirrors the AG Studio 3 "Studio Agent Framework" surface (Harness / Agents /
// Tools / ChatUI) as a framework-faithful pattern, wired to ProcurePilot's
// own LLM path (HuggingFace router) and data layer (ledger + catalog).
//
// Seam for the real package: when the AG Studio trial key lands, `npm i`
// the commercial package and swap the view layer (components/dashboard/
// StudioView.tsx) to the real Studio components. The agent definition, tools,
// harness loop, and anomaly detectors in this directory stay unchanged —
// only the LLM adapter's transport (here: /api/studio/llm) gets pointed at
// Studio's AgLlmAdapter contract.

// ─── Conversation items (Studio "turn" shape) ────────────────────────────

export type StudioRole = "system" | "user" | "assistant" | "tool";

export interface StudioTextPart {
  type: "text";
  text: string;
}

export interface StudioToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface StudioToolResultPart {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: string;
}

export type StudioContentPart =
  | StudioTextPart
  | StudioToolCallPart
  | StudioToolResultPart;

export interface StudioMessage {
  role: StudioRole;
  content: StudioContentPart[];
}

// ─── Tools ───────────────────────────────────────────────────────────────

export interface StudioToolParam {
  type: "string" | "number" | "integer" | "boolean";
  description: string;
  enum?: string[];
}

export interface StudioToolDef {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, StudioToolParam>;
    required?: string[];
  };
  /** Server-side implementation. Serialized result is fed back to the model. */
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
}

// ─── Agents ──────────────────────────────────────────────────────────────

export interface StudioAgent {
  name: string;
  /** System instructions for the agent. */
  instructions: string;
  tools: StudioToolDef[];
  maxSteps: number;
}

// ─── Harness (createAiHarness-style) ─────────────────────────────────────

export interface ChatRequest {
  messages: StudioMessage[];
  tools: StudioToolDef[];
  system?: string;
}

export interface LlmToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ChatResponse {
  text: string;
  toolCalls: LlmToolCall[];
  /** Set when the provider failed (e.g. no credits) — callers degrade gracefully. */
  error?: string;
}

/** The LLM adapter: one Studio turn -> one model call. Swappable. */
export type ChatFn = (req: ChatRequest) => Promise<ChatResponse>;

export interface Harness {
  chat: ChatFn;
}

export interface AgentTraceStep {
  step: number;
  toolCalls: { name: string; input: Record<string, unknown> }[];
  toolResults: { name: string; ok: boolean; preview: string }[];
}

export interface AgentAnswer {
  answer: string;
  trace: AgentTraceStep[];
  stepsUsed: number;
  degraded: boolean;
}

/** createAiHarness-style constructor: bind an LLM adapter into a harness. */
export function createAiHarness(chat: ChatFn): Harness {
  return { chat };
}
