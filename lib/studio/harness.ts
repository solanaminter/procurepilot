// ProcurePilot — Studio harness: the agent turn loop.
//
// createAiHarness-style: a Harness binds a ChatFn (LLM adapter). runAgentTurn
// executes the classic tool loop against the agent's tools:
//
//   user question -> model -> tool calls -> execute server-side ->
//   results back to model -> ... -> final answer
//
// Tools execute server-side here (unlike Studio's browser-executed tools),
// which keeps ledger/catalog access on the server next to the data layer.

import type {
  AgentAnswer,
  AgentTraceStep,
  Harness,
  StudioAgent,
  StudioMessage,
  StudioToolDef,
} from "./types";

function preview(value: unknown, max = 220): string {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export async function runAgentTurn(
  harness: Harness,
  agent: StudioAgent,
  question: string,
  history: StudioMessage[] = [],
): Promise<AgentAnswer> {
  const toolsByName = new Map(agent.tools.map((t) => [t.name, t]));
  const messages: StudioMessage[] = [
    ...history,
    { role: "user", content: [{ type: "text", text: question }] },
  ];
  const trace: AgentTraceStep[] = [];

  for (let step = 1; step <= agent.maxSteps; step++) {
    let res;
    try {
      res = await harness.chat({ messages, tools: agent.tools, system: agent.instructions });
    } catch (err) {
      return {
        answer: "",
        trace,
        stepsUsed: step - 1,
        degraded: true,
      };
    }
    if (res.error) {
      return {
        answer: `I couldn't reach the language model (${res.error}). The deterministic anomaly scan below still works — open the "Anomaly alerts" tab for what the data shows.`,
        trace,
        stepsUsed: step - 1,
        degraded: true,
      };
    }

    const knownCalls = res.toolCalls.filter((c) => toolsByName.has(c.name));
    if (knownCalls.length === 0) {
      messages.push({
        role: "assistant",
        content: [{ type: "text", text: res.text }],
      });
      return { answer: res.text, trace, stepsUsed: step, degraded: false };
    }

    const stepTrace: AgentTraceStep = { step, toolCalls: [], toolResults: [] };
    const resultParts: StudioMessage["content"] = [];
    for (const call of knownCalls) {
      const tool = toolsByName.get(call.name) as StudioToolDef;
      stepTrace.toolCalls.push({ name: call.name, input: call.input });
      let output: unknown;
      let ok = true;
      try {
        output = await tool.execute(call.input);
      } catch (err) {
        ok = false;
        output = { error: err instanceof Error ? err.message : String(err) };
      }
      stepTrace.toolResults.push({ name: call.name, ok, preview: preview(output) });
      resultParts.push({
        type: "tool-result",
        toolCallId: call.id,
        toolName: call.name,
        output: typeof output === "string" ? output : JSON.stringify(output),
      });
    }
    trace.push(stepTrace);

    messages.push({
      role: "assistant",
      content: [
        ...(res.text ? [{ type: "text" as const, text: res.text }] : []),
        ...knownCalls.map((c) => ({
          type: "tool-call" as const,
          toolCallId: c.id,
          toolName: c.name,
          input: c.input,
        })),
      ],
    });
    messages.push({ role: "tool", content: resultParts });
  }

  // Ran out of steps — synthesize from what the tools returned.
  const last = trace[trace.length - 1];
  return {
    answer:
      `I ran ${agent.maxSteps} analysis steps without converging on a final answer. ` +
      `Last tool results: ${last ? last.toolResults.map((r) => `${r.name}: ${r.preview}`).join(" | ") : "none"}. ` +
      `Try a more specific question (e.g. "show me this month's anomalies" or "which supplier raised prices?").`,
    trace,
    stepsUsed: agent.maxSteps,
    degraded: false,
  };
}
