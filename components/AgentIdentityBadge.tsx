"use client";

// ProcurePilot — AgentID identity badge.
// Fetches the public agent identity from GET /api/agent-identity and renders
// it in two variants: "compact" (slim strip under the chat header) and "full"
// (identity panel on the merchant dashboard). `useAgentIdentity` is shared so
// pages can read the identity (e.g. owner name on the approval card) without
// duplicate fetches.

import { useEffect, useState } from "react";
import type { AgentIdentity } from "../lib/agentid";

export function useAgentIdentity(): AgentIdentity | null {
  const [identity, setIdentity] = useState<AgentIdentity | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/agent-identity")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d && typeof d === "object" && "identity" in d) {
          setIdentity((d as { identity: AgentIdentity }).identity);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return identity;
}

function StatusPill({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-700/60 bg-emerald-950/60 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      AgentID verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-700/60 bg-amber-950/40 px-2 py-0.5 text-[11px] font-medium text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      Demo identity
    </span>
  );
}

function CompactBadge({ identity }: { identity: AgentIdentity }) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-400">
      <span
        aria-hidden
        className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-600/20 text-[11px] text-emerald-300"
      >
        ✦
      </span>
      <span className="truncate font-medium text-neutral-300">
        {identity.agentEmail}
      </span>
      <span className="hidden text-neutral-600 sm:inline">·</span>
      <span className="hidden sm:inline">Owner: {identity.ownerName}</span>
      <StatusPill verified={identity.verified} />
    </div>
  );
}

function FullPanel({ identity }: { identity: AgentIdentity }) {
  const rows: Array<[string, string, boolean?]> = [
    ["Agent ID", identity.sub, true],
    ["Agent email", identity.agentEmail, false],
    ["Actor type", identity.actorType, true],
    ["Human owner", `${identity.ownerName} · ${identity.ownerEmail}`, false],
  ];
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/20 text-lg text-emerald-300"
          >
            ✦
          </span>
          <div>
            <p className="font-semibold text-neutral-100">
              ProcurePilot agent identity
            </p>
            <p className="text-xs text-neutral-500">
              Signed in with AgentID — “Sign in with Google” for agents
            </p>
          </div>
        </div>
        <StatusPill verified={identity.verified} />
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([label, value, mono]) => (
          <div key={label} className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 text-xs uppercase tracking-wide text-neutral-500">
              {label}
            </dt>
            <dd
              className={`truncate text-right text-neutral-200 ${mono ? "font-mono text-[13px]" : ""}`}
              title={value}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-t border-neutral-800 pt-3 text-xs leading-relaxed text-neutral-500">
        Every order this agent touches is attributable to this identity and its
        human owner — verifiable identity, tap-to-approve, PayPal sandbox.
      </p>
    </div>
  );
}

export default function AgentIdentityBadge({
  variant = "compact",
}: {
  variant?: "compact" | "full";
}) {
  const identity = useAgentIdentity();
  if (!identity) return null;
  return variant === "full" ? (
    <FullPanel identity={identity} />
  ) : (
    <CompactBadge identity={identity} />
  );
}
