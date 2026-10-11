"use client";

// ProcurePilot merchant dashboard — spend analytics.
// Three AG Grid summaries (by merchant, by category, by month) plus
// hand-rolled SVG charts and a savings tracker panel.

import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { dashboardTheme } from "./agGridTheme";
import { BarChart, GroupedBarChart } from "./charts";
import { fmtUSD } from "../format";
import type { LedgerOrder } from "@/lib/ledger";

interface MerchantRow {
  merchant: string;
  orders: number;
  spendCents: number;
  savingsCents: number;
  savingsRatePct: number;
}

interface CategoryRow {
  category: string;
  orders: number;
  spendCents: number;
  savingsCents: number;
  sharePct: number;
}

interface MonthRow {
  month: string;
  monthKey: string;
  orders: number;
  spendCents: number;
  naiveCents: number;
  savingsCents: number;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthLabel(iso: string): { key: string; label: string } {
  const d = new Date(iso);
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return { key, label: `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` };
}

const right = "ag-right-aligned-cell";

export default function AnalyticsView({ orders }: { orders: LedgerOrder[] }) {
  const merchants = useMemo<MerchantRow[]>(() => {
    const map = new Map<string, MerchantRow>();
    for (const o of orders) {
      // Attribute each line to its own merchant for accurate spend splits.
      const seen = new Set<string>();
      for (const l of o.lines) {
        const lineTotal = l.quantity * l.unitPriceCents + l.shippingCents;
        // Pro-rate this order's savings across its lines by line total.
        const share = o.totalCents > 0 ? lineTotal / o.totalCents : 0;
        const row =
          map.get(l.merchant) ??
          { merchant: l.merchant, orders: 0, spendCents: 0, savingsCents: 0, savingsRatePct: 0 };
        if (!seen.has(o.orderId)) {
          row.orders += 1;
          seen.add(o.orderId);
        }
        row.spendCents += lineTotal;
        row.savingsCents += Math.round(o.savingsCents * share);
        map.set(l.merchant, row);
      }
    }
    const rows = [...map.values()];
    for (const r of rows) {
      const naive = r.spendCents + r.savingsCents;
      r.savingsRatePct = naive > 0 ? (r.savingsCents / naive) * 100 : 0;
    }
    return rows.sort((a, b) => b.spendCents - a.spendCents);
  }, [orders]);

  const categories = useMemo<CategoryRow[]>(() => {
    const totalSpend = orders.reduce((s, o) => s + o.totalCents, 0) || 1;
    const map = new Map<string, CategoryRow>();
    for (const o of orders) {
      const row =
        map.get(o.category) ??
        { category: o.category, orders: 0, spendCents: 0, savingsCents: 0, sharePct: 0 };
      row.orders += 1;
      row.spendCents += o.totalCents;
      row.savingsCents += o.savingsCents;
      map.set(o.category, row);
    }
    const rows = [...map.values()];
    for (const r of rows) r.sharePct = (r.spendCents / totalSpend) * 100;
    return rows.sort((a, b) => b.spendCents - a.spendCents);
  }, [orders]);

  const months = useMemo<MonthRow[]>(() => {
    const map = new Map<string, MonthRow>();
    for (const o of orders) {
      const { key, label } = monthLabel(o.createdAt);
      const row =
        map.get(key) ??
        { month: label, monthKey: key, orders: 0, spendCents: 0, naiveCents: 0, savingsCents: 0 };
      row.orders += 1;
      row.spendCents += o.totalCents;
      row.naiveCents += o.naiveTotalCents;
      row.savingsCents += o.savingsCents;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [orders]);

  const merchantCols = useMemo<ColDef<MerchantRow>[]>(
    () => [
      { field: "merchant", headerName: "Merchant", flex: 1, minWidth: 140, filter: "agTextColumnFilter" },
      { field: "orders", headerName: "Orders", width: 100, cellClass: right, filter: "agNumberColumnFilter" },
      { field: "spendCents", headerName: "Spend", width: 130, valueFormatter: (p) => fmtUSD(p.value as number), cellClass: right, filter: "agNumberColumnFilter", sort: "desc" },
      { field: "savingsCents", headerName: "Saved", width: 130, valueFormatter: (p) => fmtUSD(p.value as number), cellClass: `${right} text-emerald-300`, filter: "agNumberColumnFilter" },
      { field: "savingsRatePct", headerName: "Savings rate", width: 140, valueFormatter: (p) => `${(p.value as number).toFixed(1)}%`, cellClass: right, filter: "agNumberColumnFilter" },
    ],
    [],
  );

  const categoryCols = useMemo<ColDef<CategoryRow>[]>(
    () => [
      { field: "category", headerName: "Category", flex: 1, minWidth: 140, filter: "agSetColumnFilter" },
      { field: "orders", headerName: "Orders", width: 100, cellClass: right, filter: "agNumberColumnFilter" },
      { field: "spendCents", headerName: "Spend", width: 130, valueFormatter: (p) => fmtUSD(p.value as number), cellClass: right, filter: "agNumberColumnFilter", sort: "desc" },
      { field: "sharePct", headerName: "Share", width: 110, valueFormatter: (p) => `${(p.value as number).toFixed(1)}%`, cellClass: right },
      { field: "savingsCents", headerName: "Saved", width: 130, valueFormatter: (p) => fmtUSD(p.value as number), cellClass: `${right} text-emerald-300`, filter: "agNumberColumnFilter" },
    ],
    [],
  );

  const monthCols = useMemo<ColDef<MonthRow>[]>(
    () => [
      { field: "month", headerName: "Month", width: 110 },
      { field: "orders", headerName: "Orders", width: 100, cellClass: right },
      { field: "spendCents", headerName: "Spend", width: 130, valueFormatter: (p) => fmtUSD(p.value as number), cellClass: right },
      { field: "naiveCents", headerName: "Naive buy", width: 130, valueFormatter: (p) => fmtUSD(p.value as number), cellClass: right },
      { field: "savingsCents", headerName: "Saved", width: 130, valueFormatter: (p) => fmtUSD(p.value as number), cellClass: `${right} text-emerald-300` },
    ],
    [],
  );

  const totalSaved = orders.reduce((s, o) => s + o.savingsCents, 0);
  const totalNaive = orders.reduce((s, o) => s + o.naiveTotalCents, 0);
  const bestOrder = orders.reduce<LedgerOrder | null>(
    (best, o) => (!best || o.savingsCents > best.savingsCents ? o : best),
    null,
  );

  const gridProps = {
    theme: dashboardTheme,
    defaultColDef: { sortable: true, filter: true, resizable: true },
    domLayout: "autoHeight" as const,
    animateRows: true,
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Savings tracker */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Savings tracker — actual vs. naive buy
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Naive buy = the priciest qualifying offer the agent compared against.
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <GroupedBarChart
              data={months.map((m) => ({
                label: m.month,
                actual: m.spendCents,
                naive: m.naiveCents,
              }))}
            />
          </div>
          <div className="flex flex-col justify-center gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Total saved to date</p>
              <p className="text-3xl font-bold text-emerald-300">{fmtUSD(totalSaved)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Savings rate</p>
              <p className="text-3xl font-bold text-neutral-100">
                {totalNaive > 0 ? ((totalSaved / totalNaive) * 100).toFixed(1) : "0.0"}%
              </p>
            </div>
            {bestOrder && (
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">Best single order</p>
                <p className="text-sm text-neutral-200">
                  {bestOrder.orderId} — saved {fmtUSD(bestOrder.savingsCents)} on{" "}
                  {bestOrder.merchantDisplay}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Spend over time */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Spend over time
        </h3>
        <div className="mt-4">
          <BarChart
            data={months.map((m) => ({ label: m.month, value: m.spendCents }))}
            barColor="#38bdf8"
          />
        </div>
        <div className="mt-2">
          <AgGridReact<MonthRow>
            {...gridProps}
            rowData={months}
            columnDefs={monthCols}
          />
        </div>
      </section>

      {/* By merchant / by category */}
      <section className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Spend by merchant
          </h3>
          <div className="mt-4">
            <AgGridReact<MerchantRow>
              {...gridProps}
              rowData={merchants}
              columnDefs={merchantCols}
            />
          </div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Spend by category
          </h3>
          <div className="mt-4">
            <AgGridReact<CategoryRow>
              {...gridProps}
              rowData={categories}
              columnDefs={categoryCols}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
