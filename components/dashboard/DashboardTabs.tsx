"use client";

// ProcurePilot merchant dashboard — tab navigation between the dashboard
// views. Orders / Analytics / Approvals are the AG Grid Community
// operational views; "Studio AI analyst" is the Studio Agent Framework layer
// (spend-analyst agent + anomaly alerts), added for the "Best Use of AG
// Grid / AG Studio" sponsor line.

import { useState } from "react";
import OrdersGrid from "./OrdersGrid";
import AnalyticsView from "./AnalyticsView";
import ApprovalsGrid from "./ApprovalsGrid";
import StudioView from "./StudioView";
import type { ApprovalRecord, LedgerOrder } from "@/lib/ledger";

const TABS = [
  { id: "orders", label: "Order ledger" },
  { id: "analytics", label: "Spend analytics" },
  { id: "approvals", label: "Approval history" },
  { id: "studio", label: "Studio AI analyst" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DashboardTabs({
  orders,
  approvals,
}: {
  orders: LedgerOrder[];
  approvals: ApprovalRecord[];
}) {
  const [tab, setTab] = useState<TabId>("orders");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Dashboard views"
        className="mb-6 flex gap-1 rounded-xl border border-neutral-800 bg-neutral-900 p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-emerald-600 text-white"
                : "text-neutral-400 hover:text-neutral-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "orders" && <OrdersGrid orders={orders} />}
      {tab === "analytics" && <AnalyticsView orders={orders} />}
      {tab === "approvals" && <ApprovalsGrid approvals={approvals} />}
      {tab === "studio" && <StudioView orders={orders} />}
    </div>
  );
}
