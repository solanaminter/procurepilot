"use client";

// ProcurePilot — Studio AI analyst view.
//
// The AG Studio layer of the merchant dashboard: a spend-analyst agent that
// answers natural-language questions over the order/transaction data, plus
// deterministic anomaly alerts (unusual amounts, duplicate re-orders,
// supplier price spikes) mirroring AG Grid's own hackathon example builds.
//
// The ChatUI below follows the Studio Agent Framework's ChatUI piece; the
// turn loop runs server-side in /api/studio/ask via lib/studio (Harness /
// Agents / Tools). When the AG Studio trial key lands, this view's shell is
// swapped for the real Studio components — agent, tools, and data layer stay.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { dashboardTheme } from "./agGridTheme";
import { fmtUSD, fmtDateTime } from "../format";
import type { LedgerOrder } from "@/lib/ledger";

interface Anomaly {
  id: string;
  kind: "unusual_amount" | "duplicate_order" | "price_spike";
  severity: "high" | "medium";
  orderId: string;
  title: string;
  detail: string;
  createdAt: string;
  totalCents: number;
}

interface TraceStep {
  step: number;
  toolCalls: { name: string; input: Record<string, unknown> }[];
  toolResults: { name: string; ok: boolean; preview: string }[];
}

interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  trace?: TraceStep[];
  degraded?: boolean;
}

const SUGGESTED = [
  "Anything unusual in the order stream?",
  "Which supplier raised their prices?",
  "How much did we spend per category?",
  "Is $99.99 a fair price for laser toner right now?",
];

const KIND_LABEL: Record<Anomaly["kind"], string> = {
  unusual_amount: "Unusual amount",
  duplicate_order: "Possible duplicate",
  price_spike: "Price spike",
};

function AnomalyCard({ a }: { a: Anomaly }) {
  const sev =
    a.severity === "high"
      ? "border-red-700/50 bg-red-500/10"
      : "border-amber-700/50 bg-amber-500/10";
  const badge =
    a.severity === "high"
      ? "bg-red-500/20 text-red-300 border-red-700/40"
      : "bg-amber-500/20 text-amber-300 border-amber-700/40";
  return (
    <div className={`rounded-xl border p-4 ${sev}`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${badge}`}>
          {a.severity.toUpperCase()}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          {KIND_LABEL[a.kind]}
        </span>
        <span className="ml-auto font-mono text-xs text-neutral-500">{a.orderId}</span>
      </div>
      <p className="text-sm font-semibold text-neutral-100">{a.title}</p>
      <p className="mt-1 text-sm text-neutral-400">{a.detail}</p>
    </div>
  );
}

function ChatPanel() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [openTrace, setOpenTrace] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || busy) return;
      setBusy(true);
      setInput("");
      setTurns((t) => [...t, { role: "user", text: q }]);
      try {
        const res = await fetch("/api/studio/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q }),
        });
        const data = await res.json();
        setTurns((t) => [
          ...t,
          {
            role: "assistant",
            text: data.answer ?? "No answer returned.",
            trace: data.trace ?? [],
            degraded: !!data.degraded,
          },
        ]);
      } catch {
        setTurns((t) => [
          ...t,
          {
            role: "assistant",
            text: "The analyst request failed to reach the server. Try again.",
            degraded: true,
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  return (
    <div className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-900">
      <div className="border-b border-neutral-800 px-4 py-3">
        <p className="text-sm font-semibold text-neutral-100">Spend analyst</p>
        <p className="text-xs text-neutral-500">
          Ask about orders, suppliers, prices, and anomalies — answered from the live ledger.
        </p>
      </div>

      <div className="max-h-96 min-h-48 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {turns.length === 0 && !busy && (
          <p className="text-sm text-neutral-500">
            No questions yet. Try one of the suggested questions below.
          </p>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-xl rounded-br-sm bg-emerald-600 px-3.5 py-2 text-sm text-white">
                {t.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-[90%] rounded-xl rounded-bl-sm border border-neutral-700 bg-neutral-800 px-3.5 py-2.5 text-sm text-neutral-100">
                {t.degraded && (
                  <p className="mb-1.5 rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-300">
                    LLM degraded — answer assembled without the model. Anomaly data below is unaffected.
                  </p>
                )}
                <p className="whitespace-pre-wrap">{t.text}</p>
                {t.trace && t.trace.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setOpenTrace(openTrace === i ? null : i)}
                      className="text-xs font-medium text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline"
                    >
                      {openTrace === i ? "Hide" : "Show"} tool trace ({t.trace.length} step
                      {t.trace.length === 1 ? "" : "s"})
                    </button>
                    {openTrace === i && (
                      <div className="mt-1.5 space-y-1.5">
                        {t.trace.map((s) => (
                          <div
                            key={s.step}
                            className="rounded-lg bg-neutral-900 px-2.5 py-1.5 font-mono text-[11px] text-neutral-400"
                          >
                            <p className="text-neutral-500">step {s.step}</p>
                            {s.toolCalls.map((c, j) => (
                              <p key={j}>
                                → {c.name}({JSON.stringify(c.input)})
                              </p>
                            ))}
                            {s.toolResults.map((r, j) => (
                              <p key={j} className={r.ok ? "text-emerald-400/80" : "text-red-400/80"}>
                                ← {r.name}: {r.preview}
                              </p>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-xl rounded-bl-sm border border-neutral-700 bg-neutral-800 px-3.5 py-2.5 text-sm text-neutral-400">
              Analyzing the ledger…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-neutral-800 px-4 py-3">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {SUGGESTED.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => ask(s)}
              className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 transition hover:border-emerald-600 hover:text-emerald-300 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the spend analyst…"
            aria-label="Ask the spend analyst"
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}

export default function StudioView({ orders }: { orders: LedgerOrder[] }) {
  const [anomalies, setAnomalies] = useState<Anomaly[] | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/studio/anomalies")
      .then((r) => r.json())
      .then((d) => {
        if (live) setAnomalies(d.anomalies ?? []);
      })
      .catch(() => {
        if (live) setAnomalies([]);
      });
    return () => {
      live = false;
    };
  }, []);

  const flaggedIds = useMemo(
    () => new Set((anomalies ?? []).map((a) => a.orderId)),
    [anomalies],
  );
  const flaggedOrders = useMemo(
    () => orders.filter((o) => flaggedIds.has(o.orderId)),
    [orders, flaggedIds],
  );

  const columnDefs = useMemo<ColDef<LedgerOrder>[]>(
    () => [
      {
        field: "orderId",
        headerName: "Order ID",
        width: 175,
        pinned: "left",
        cellRenderer: (p: ICellRendererParams<LedgerOrder>) => (
          <span className="font-mono text-xs text-neutral-300">{p.value}</span>
        ),
      },
      {
        field: "createdAt",
        headerName: "Date",
        width: 170,
        valueFormatter: (p) => fmtDateTime(p.value as string),
        sort: "desc",
      },
      { field: "merchantDisplay", headerName: "Merchant", width: 140 },
      {
        field: "totalCents",
        headerName: "Total",
        width: 120,
        valueFormatter: (p) => fmtUSD(p.value as number),
        cellClass: "ag-right-aligned-cell",
      },
      {
        headerName: "Flags",
        width: 220,
        valueGetter: (p) =>
          (anomalies ?? [])
            .filter((a) => a.orderId === p.data?.orderId)
            .map((a) => KIND_LABEL[a.kind])
            .join(", "),
        cellRenderer: (p: ICellRendererParams<LedgerOrder>) => (
          <span className="text-xs font-medium text-amber-300">{p.value}</span>
        ),
      },
    ],
    [anomalies],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-4 py-3">
        <p className="text-sm font-semibold text-emerald-200">
          Studio AI analyst <span className="font-normal text-emerald-400/70">(preview)</span>
        </p>
        <p className="mt-0.5 text-xs text-neutral-400">
          Spend-analyst agent + anomaly alerts over the transaction stream, built on the
          Studio Agent Framework pattern. The full AG Studio package drops into this
          view when the trial key lands — agent, tools, and data layer stay as-is.
        </p>
      </div>

      <ChatPanel />

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Anomaly alerts
          {anomalies !== null && (
            <span className="ml-2 rounded-full bg-neutral-800 px-2 py-0.5 text-xs normal-case text-neutral-300">
              {anomalies.length} found
            </span>
          )}
        </h3>
        {anomalies === null ? (
          <p className="text-sm text-neutral-500">Scanning the transaction stream…</p>
        ) : anomalies.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No anomalies in the current stream. Unusual amounts, duplicate re-orders, and
            supplier price spikes will appear here.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {anomalies.map((a) => (
              <AnomalyCard key={a.id} a={a} />
            ))}
          </div>
        )}
      </div>

      {flaggedOrders.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Flagged orders
          </h3>
          <div style={{ height: 320, width: "100%" }}>
            <AgGridReact<LedgerOrder>
              theme={dashboardTheme}
              rowData={flaggedOrders}
              columnDefs={columnDefs}
              defaultColDef={{ sortable: true, filter: true, resizable: true }}
              domLayout="normal"
              animateRows={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
