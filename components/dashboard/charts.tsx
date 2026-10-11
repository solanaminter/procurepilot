"use client";

// Tiny hand-rolled SVG charts for the ProcurePilot dashboard —
// no charting dependency, just enough to tell the spend/savings story.

import { fmtUSD } from "../format";

export function BarChart({
  data,
  height = 180,
  barColor = "#10b981",
  formatValue,
}: {
  data: { label: string; value: number }[];
  height?: number;
  barColor?: string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 560;
  const h = height;
  const padB = 34;
  const padT = 8;
  const slot = w / Math.max(data.length, 1);
  const barW = Math.min(44, slot * 0.55);
  const fmt = formatValue ?? fmtUSD;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      role="img"
      aria-label="Bar chart"
    >
      {data.map((d, i) => {
        const bh = ((h - padB - padT) * d.value) / max;
        const x = slot * i + (slot - barW) / 2;
        const y = h - padB - bh;
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(bh, 2)}
              rx={4}
              fill={barColor}
              opacity={0.85}
            />
            <text
              x={x + barW / 2}
              y={y - 6}
              textAnchor="middle"
              fill="#a3a3a3"
              fontSize={10}
            >
              {fmt(d.value)}
            </text>
            <text
              x={x + barW / 2}
              y={h - padB + 16}
              textAnchor="middle"
              fill="#737373"
              fontSize={10}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function GroupedBarChart({
  data,
  height = 200,
}: {
  data: { label: string; actual: number; naive: number }[];
  height?: number;
}) {
  const max = Math.max(...data.flatMap((d) => [d.actual, d.naive]), 1);
  const w = 560;
  const h = height;
  const padB = 34;
  const padT = 24;
  const slot = w / Math.max(data.length, 1);
  const barW = Math.min(30, slot * 0.28);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      role="img"
      aria-label="Actual vs naive spend chart"
    >
      <g fontSize={10} fill="#a3a3a3">
        <rect x={w - 210} y={4} width={10} height={10} rx={2} fill="#10b981" />
        <text x={w - 196} y={13}>Paid (actual)</text>
        <rect x={w - 100} y={4} width={10} height={10} rx={2} fill="#525252" />
        <text x={w - 86} y={13}>Naive buy</text>
      </g>
      {data.map((d, i) => {
        const cx = slot * i + slot / 2;
        const mkBar = (v: number, color: string, dx: number) => {
          const bh = ((h - padB - padT) * v) / max;
          return (
            <rect
              x={cx + dx - barW / 2}
              y={h - padB - bh}
              width={barW}
              height={Math.max(bh, 2)}
              rx={4}
              fill={color}
              opacity={0.9}
            />
          );
        };
        return (
          <g key={d.label}>
            {mkBar(d.naive, "#525252", -barW / 2 - 2)}
            {mkBar(d.actual, "#10b981", barW / 2 + 2)}
            <text
              x={cx}
              y={h - padB + 16}
              textAnchor="middle"
              fill="#737373"
              fontSize={10}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
