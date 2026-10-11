"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import ChatMessage from "../components/ChatMessage";
import AgentIdentityBadge, {
  useAgentIdentity,
} from "../components/AgentIdentityBadge";
import ComparisonCard from "../components/ComparisonCard";
import ApprovalCard from "../components/ApprovalCard";
import OrderStatusCard from "../components/OrderStatusCard";
import { IntentCard, OffersCard } from "../components/ProcureCards";
import {
  useProcureChat,
  type ProcureMessage,
} from "../components/useProcureChat";
import type {
  CreatedOrder,
  OrderLine,
  ProcurementIntent,
} from "../lib/adapters/types";

const CANCELLED_TEXT = "Order cancelled — tell me what to adjust.";

function latestIntentBefore(
  message: ProcureMessage,
  partIndex: number,
): ProcurementIntent | null {
  for (let i = partIndex; i >= 0; i--) {
    const p = message.parts[i];
    if (p.type === "data-intent") return p.data;
  }
  return null;
}

export default function Home() {
  const {
    messages,
    status,
    error,
    sendMessage,
    appendAssistantText,
    stop,
    clearError,
  } = useProcureChat();

  const [input, setInput] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  // Placed orders keyed by `${messageId}:${partIndex}` of the proposal they came from.
  const [orders, setOrders] = useState<Record<string, CreatedOrder>>({});
  const [placingKey, setPlacingKey] = useState<string | null>(null);
  // Agent identity (AgentID) — surfaced in the header strip and approval card.
  const agentIdentity = useAgentIdentity();

  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    void sendMessage(input);
    setInput("");
  };

  const handleApprove = async (key: string, lines: OrderLine[]) => {
    setPlacingKey(key);
    setBanner(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Order request failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
        );
      }
      const order = (await res.json()) as CreatedOrder;
      setOrders((prev) => ({ ...prev, [key]: order }));
    } catch (e) {
      setBanner(
        e instanceof Error ? e.message : "Order request failed. Please try again.",
      );
    } finally {
      setPlacingKey(null);
    }
  };

  const handleReject = () => {
    appendAssistantText(CANCELLED_TEXT);
  };

  return (
    <main className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 font-bold text-white">
              P
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">ProcurePilot</h1>
              <p className="text-xs text-neutral-400">AI procurement agent</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
          >
            Merchant dashboard
          </Link>
        </div>
      </header>

      {/* Agent identity strip */}
      <div className="border-b border-neutral-800 bg-neutral-900/40">
        <div className="mx-auto max-w-4xl px-4 py-2 sm:px-6">
          <AgentIdentityBadge variant="compact" />
        </div>
      </div>

      {/* Error banner */}
      {(error || banner) && (
        <div className="border-b border-red-900 bg-red-950/50">
          <div className="mx-auto flex max-w-4xl items-start justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm text-red-300">
              {(error?.message ?? "") || banner || ""}
            </p>
            <button
              type="button"
              onClick={() => {
                clearError();
                setBanner(null);
              }}
              className="shrink-0 rounded px-2 py-0.5 text-sm text-red-400 hover:bg-red-900/60"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Message list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6">
          {messages.length === 0 && (
            <div className="mt-10 text-center">
              <h2 className="text-2xl font-bold tracking-tight">
                What does your business need?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-neutral-400">
                Describe an item and a quantity in plain language. ProcurePilot
                searches merchants, compares landed costs, and prepares an
                order for your approval — you always approve before anything is
                paid.
              </p>
              <div className="mx-auto mt-6 grid max-w-xl gap-2 text-left sm:grid-cols-2">
                {[
                  "50 ergonomic office chairs under $200 each",
                  "20 cases of A4 copy paper, delivery within 5 days",
                  "10 USB-C docking stations for the new hires",
                  "Order restock: 100 nitrile gloves, cheapest landed cost",
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setInput(s);
                    }}
                    className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left text-sm text-neutral-300 transition hover:border-emerald-700 hover:text-neutral-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage key={message.id} message={message}>
              {message.role === "assistant" &&
                message.parts.map((part, idx) => {
                  if (part.type === "data-intent") {
                    return <IntentCard key={idx} intent={part.data} />;
                  }
                  if (part.type === "data-offers") {
                    return <OffersCard key={idx} offers={part.data} />;
                  }
                  if (part.type === "data-comparison") {
                    const intent = latestIntentBefore(message, idx);
                    return (
                      <ComparisonCard
                        key={idx}
                        comparison={part.data}
                        quantity={intent?.quantity ?? 1}
                      />
                    );
                  }
                  if (part.type === "data-orderProposal") {
                    const key = `${message.id}:${idx}`;
                    const existing = orders[key];
                    if (existing) {
                      return <OrderStatusCard key={idx} order={existing} />;
                    }
                    return (
                      <ApprovalCard
                        key={idx}
                        proposal={part.data}
                        placing={placingKey === key}
                        ownerName={agentIdentity?.ownerName}
                        onApprove={() =>
                          void handleApprove(key, part.data.lines)
                        }
                        onReject={handleReject}
                      />
                    );
                  }
                  return null;
                })}
            </ChatMessage>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-neutral-800 bg-neutral-900 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-neutral-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  ProcurePilot is {status === "submitted" ? "thinking" : "responding"}…
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-neutral-800 bg-neutral-900/60">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-4xl items-end gap-3 px-4 py-4 sm:px-6"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. I need 30 standing desks under $400 each…"
            className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
            disabled={busy}
            aria-label="Procurement request"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              className="rounded-xl border border-neutral-700 px-5 py-3 font-semibold text-neutral-300 transition hover:border-neutral-500"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          )}
        </form>
        <p className="mx-auto max-w-4xl px-4 pb-3 text-center text-xs text-neutral-600 sm:px-6">
          ProcurePilot prepares orders for your review. Nothing is paid until
          you approve.
        </p>
      </div>
    </main>
  );
}
