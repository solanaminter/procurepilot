"use client";

// ProcurePilot merchant dashboard — order ledger, master-detail.
// Master grid: one row per order. Expanding a row reveals the line-item
// detail grid (product, qty, unit price, shipping, line total).

import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  GridApi,
  ICellRendererParams,
} from "ag-grid-community";
import { dashboardTheme } from "./agGridTheme";
import { fmtUSD, fmtDateTime } from "../format";
import type { LedgerOrder } from "@/lib/ledger";
import type { OrderLine } from "@/lib/adapters/types";

function StatusBadge({ value }: { value: LedgerOrder["status"] }) {
  const styles: Record<LedgerOrder["status"], string> = {
    COMPLETED: "bg-emerald-500/15 text-emerald-300 border-emerald-700/40",
    APPROVED: "bg-sky-500/15 text-sky-300 border-sky-700/40",
    CREATED: "bg-amber-500/15 text-amber-300 border-amber-700/40",
  };
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[value]}`}
    >
      {value}
    </span>
  );
}

function SavingsCell({ data }: ICellRendererParams<LedgerOrder>) {
  if (!data) return null;
  const pct =
    data.naiveTotalCents > 0
      ? (data.savingsCents / data.naiveTotalCents) * 100
      : 0;
  return (
    <span className="font-medium text-emerald-300">
      {fmtUSD(data.savingsCents)}{" "}
      <span className="text-xs text-emerald-400/70">({pct.toFixed(1)}%)</span>
    </span>
  );
}

interface LineRow extends OrderLine {
  lineTotalCents: number;
}

function OrderLinesDetail({ data }: { data: LedgerOrder }) {
  const lineRows: LineRow[] = useMemo(
    () =>
      data.lines.map((l) => ({
        ...l,
        lineTotalCents: l.quantity * l.unitPriceCents + l.shippingCents,
      })),
    [data],
  );
  const detailCols = useMemo<ColDef<LineRow>[]>(
    () => [
      { field: "title", headerName: "Product", flex: 2, minWidth: 220 },
      { field: "merchant", headerName: "Merchant", width: 130 },
      {
        field: "quantity",
        headerName: "Qty",
        width: 80,
        cellClass: "ag-right-aligned-cell",
      },
      {
        field: "unitPriceCents",
        headerName: "Unit price",
        width: 120,
        valueFormatter: (p) => fmtUSD(p.value as number),
        cellClass: "ag-right-aligned-cell",
      },
      {
        field: "shippingCents",
        headerName: "Shipping",
        width: 110,
        valueFormatter: (p) => fmtUSD(p.value as number),
        cellClass: "ag-right-aligned-cell",
      },
      {
        field: "lineTotalCents",
        headerName: "Line total",
        width: 120,
        valueFormatter: (p) => fmtUSD(p.value as number),
        cellClass: "ag-right-aligned-cell",
      },
    ],
    [],
  );
  return (
    <div className="p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Line items — {data.orderId}
      </p>
      <AgGridReact<LineRow>
        theme={dashboardTheme}
        rowData={lineRows}
        columnDefs={detailCols}
        domLayout="autoHeight"
        defaultColDef={{ sortable: true, resizable: true }}
      />
    </div>
  );
}

export default function OrdersGrid({ orders }: { orders: LedgerOrder[] }) {
  const apiRef = useRef<GridApi<LedgerOrder> | null>(null);
  const [query, setQuery] = useState("");

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
        filter: "agTextColumnFilter",
      },
      {
        field: "createdAt",
        headerName: "Date",
        width: 175,
        valueFormatter: (p) => fmtDateTime(p.value as string),
        filter: "agDateColumnFilter",
        sort: "desc",
      },
      {
        field: "merchantDisplay",
        headerName: "Merchant",
        width: 150,
        filter: "agTextColumnFilter",
      },
      {
        field: "category",
        headerName: "Category",
        width: 125,
        filter: "agSetColumnFilter",
      },
      {
        headerName: "Items",
        width: 85,
        valueGetter: (p) => p.data?.lines.length ?? 0,
        cellClass: "ag-right-aligned-cell",
      },
      {
        field: "totalCents",
        headerName: "Total",
        width: 120,
        valueFormatter: (p) => fmtUSD(p.value as number),
        cellClass: "ag-right-aligned-cell",
        filter: "agNumberColumnFilter",
      },
      {
        field: "savingsCents",
        headerName: "Saved",
        width: 150,
        cellRenderer: SavingsCell,
        cellClass: "ag-right-aligned-cell",
        filter: "agNumberColumnFilter",
      },
      {
        field: "status",
        headerName: "Status",
        width: 140,
        cellRenderer: (p: ICellRendererParams<LedgerOrder>) =>
          p.value ? <StatusBadge value={p.value} /> : null,
        filter: "agSetColumnFilter",
      },
    ],
    [],
  );

  const onGridReady = useCallback((params: { api: GridApi<LedgerOrder> }) => {
    apiRef.current = params.api;
  }, []);

  const onSearch = useCallback((value: string) => {
    setQuery(value);
    apiRef.current?.setGridOption("quickFilterText", value);
  }, []);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search orders, merchants, IDs…"
          className="w-64 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
          aria-label="Search orders"
        />
        <button
          type="button"
          onClick={() =>
            apiRef.current?.exportDataAsCsv({ fileName: "procurepilot-orders.csv" })
          }
          className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
        >
          Export CSV
        </button>
        <p className="ml-auto text-xs text-neutral-500">
          Click the chevron to expand line items
        </p>
      </div>
      <div style={{ height: 560, width: "100%" }}>
        <AgGridReact<LedgerOrder>
          theme={dashboardTheme}
          rowData={orders}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          masterDetail={true}
          detailCellRenderer={OrderLinesDetail}
          detailRowHeight={280}
          pagination={true}
          paginationPageSize={10}
          onGridReady={onGridReady}
          animateRows={true}
        />
      </div>
    </div>
  );
}
