// ProcurePilot — merchant dashboard (server component).
// Fetches the order ledger + approval history from the dashboard data layer
// (seeded demo history + live session orders) and renders KPI cards plus the
// tabbed AG Grid views.

import Link from "next/link";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import AgentIdentityBadge from "@/components/AgentIdentityBadge";
import { fmtUSD } from "@/components/format";
import {
  getApprovals,
  getLedgerOrders,
  getLedgerSummary,
} from "@/lib/ledger";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const orders = getLedgerOrders();
  const approvals = getApprovals();
  const summary = getLedgerSummary();

  const kpis = [
    {
      label: "Total spend",
      value: fmtUSD(summary.totalSpendCents),
      tone: "text-neutral-100",
    },
    {
      label: "Total saved",
      value: fmtUSD(summary.totalSavingsCents),
      tone: "text-emerald-300",
    },
    {
      label: "Savings rate",
      value: `${summary.savingsRatePct.toFixed(1)}%`,
      tone: "text-neutral-100",
    },
    {
      label: "Orders",
      value: String(summary.orderCount),
      tone: "text-neutral-100",
    },
    {
      label: "Pending approval",
      value: String(summary.pendingApprovals),
      tone: summary.pendingApprovals > 0 ? "text-amber-300" : "text-neutral-100",
    },
  ];

  return (
    <main className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 bg-neutral-900/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 font-bold text-white">
              P
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">ProcurePilot</h1>
              <p className="text-xs text-neutral-400">Merchant dashboard</p>
            </div>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
          >
            Back to chat
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {/* Agent identity panel */}
        <div className="mb-6">
          <AgentIdentityBadge variant="full" />
        </div>

        {/* KPI cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3"
            >
              <p className="text-xs uppercase tracking-wide text-neutral-500">
                {k.label}
              </p>
              <p className={`mt-1 text-2xl font-bold ${k.tone}`}>{k.value}</p>
            </div>
          ))}
        </div>

        <DashboardTabs orders={orders} approvals={approvals} />
      </div>
    </main>
  );
}
