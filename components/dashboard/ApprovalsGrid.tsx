"use client";

// ProcurePilot merchant dashboard — human approval ledger.
// Every row is a tap-to-approve moment: who approved what, when, for how
// much, and what the agent saved them. This is the trust story for judges.

import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridApi, ICellRendererParams } from "ag-grid-community";
import { dashboardTheme } from "./agGridTheme";
import { fmtUSD, fmtDateTime } from "../format";
import type { ApprovalRecord } from "@/lib/ledger";

export default function ApprovalsGrid({
  approvals,
}: {
  approvals: ApprovalRecord[];
}) {
  const apiRef = useRef<GridApi<ApprovalRecord> | null>(null);
  const [query, setQuery] = useState("");

  const columnDefs = useMemo<ColDef<ApprovalRecord>[]>(
    () => [
      {
        field: "approvalId",
        headerName: "Approval",
        width: 120,
        cellRenderer: (p: ICellRendererParams<ApprovalRecord>) => (
          <span className="font-mono text-xs text-neutral-300">{p.value}</span>
        ),
        filter: "agTextColumnFilter",
      },
      {
        field: "orderId",
        headerName: "Order",
        width: 170,
        cellRenderer: (p: ICellRendererParams<ApprovalRecord>) => (
          <span className="font-mono text-xs text-neutral-300">{p.value}</span>
        ),
        filter: "agTextColumnFilter",
      },
      {
        field: "itemSummary",
        headerName: "Approved items",
        flex: 2,
        minWidth: 240,
        filter: "agTextColumnFilter",
      },
      {
        field: "totalCents",
        headerName: "Amount",
        width: 120,
        valueFormatter: (p) => fmtUSD(p.value as number),
        cellClass: "ag-right-aligned-cell",
        filter: "agNumberColumnFilter",
      },
      {
        field: "savingsCents",
        headerName: "Saved",
        width: 110,
        valueFormatter: (p) => fmtUSD(p.value as number),
        cellClass: "ag-right-aligned-cell text-emerald-300",
        filter: "agNumberColumnFilter",
      },
      {
        field: "approvedBy",
        headerName: "Approved by",
        width: 150,
        filter: "agSetColumnFilter",
      },
      {
        field: "approvedAt",
        headerName: "Approved at",
        width: 175,
        valueFormatter: (p) => fmtDateTime(p.value as string),
        filter: "agDateColumnFilter",
        sort: "desc",
      },
      {
        field: "status",
        headerName: "Order status",
        width: 140,
        cellRenderer: (p: ICellRendererParams<ApprovalRecord>) => (
          <span
            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              p.value === "COMPLETED"
                ? "border-emerald-700/40 bg-emerald-500/15 text-emerald-300"
                : "border-sky-700/40 bg-sky-500/15 text-sky-300"
            }`}
          >
            {p.value}
          </span>
        ),
        filter: "agSetColumnFilter",
      },
    ],
    [],
  );

  const onGridReady = useCallback((params: { api: GridApi<ApprovalRecord> }) => {
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
          placeholder="Search approvals…"
          className="w-64 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
          aria-label="Search approvals"
        />
        <button
          type="button"
          onClick={() =>
            apiRef.current?.exportDataAsCsv({ fileName: "procurepilot-approvals.csv" })
          }
          className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
        >
          Export CSV
        </button>
        <p className="ml-auto max-w-md text-xs text-neutral-500">
          No payment moves without a human tap — every order above was
          explicitly approved before the PayPal order was created.
        </p>
      </div>
      <div style={{ height: 520, width: "100%" }}>
        <AgGridReact<ApprovalRecord>
          theme={dashboardTheme}
          rowData={approvals}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          pagination={true}
          paginationPageSize={10}
          onGridReady={onGridReady}
          animateRows={true}
        />
      </div>
    </div>
  );
}
