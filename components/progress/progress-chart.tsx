"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

export type Point = { t: number; score: number };
type Row = { t: number; readiness: number | null; meetings: number | null };

/** One row per moment, so the tooltip only shows scores recorded at that time. */
function mergeSeries(readiness: Point[], meetings: Point[]): Row[] {
  const rows = new Map<number, Row>();
  for (const p of readiness) rows.set(p.t, { ...(rows.get(p.t) ?? { t: p.t, meetings: null }), readiness: p.score });
  for (const p of meetings) rows.set(p.t, { ...(rows.get(p.t) ?? { t: p.t, readiness: null }), meetings: p.score });
  return [...rows.values()].sort((a, b) => a.t - b.t);
}

const SERIES = [
  { key: "readiness", name: "Readiness score", color: "var(--chart-1)" },
  { key: "meetings", name: "Investor Room score", color: "var(--chart-2)" },
] as const;

const BANDS = [
  { y: 50, label: "Getting there" },
  { y: 70, label: "Nearly ready" },
  { y: 85, label: "Investor ready" },
];

const dayFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" });

function TooltipBody({ active, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as Row;
  const present = payload.filter((p) => p.value !== null && p.value !== undefined);
  if (!present.length) return null;
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-1">{dayFormat.format(new Date(point.t))}</p>
      {present.map((p) => (
        <p key={String(p.name)} className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded" style={{ background: String(p.color) }} />
          {p.name}: <span className="font-medium tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function lastIndex(rows: Row[], key: "readiness" | "meetings"): number {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i][key] !== null) return i;
  return -1;
}

/** Readiness and meeting scores over time on one 0–100 axis, with band thresholds. */
export function ProgressChart({ readiness, meetings }: { readiness: Point[]; meetings: Point[] }) {
  const data = { readiness, meetings };
  const rows = mergeSeries(readiness, meetings);
  const all = [...readiness, ...meetings];
  const min = Math.min(...all.map((p) => p.t));
  const max = Math.max(...all.map((p) => p.t));
  // Pad a single day so one point doesn't sit on the edge.
  const pad = max === min ? 86_400_000 : (max - min) * 0.04;
  const latest = (series: Point[]) => series.at(-1);

  return (
    <figure className="grid gap-3">
      <div className="flex flex-wrap gap-4 text-sm" aria-hidden="true">
        {SERIES.map((s) =>
          data[s.key].length ? (
            <span key={s.key} className="flex items-center gap-2">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
              {s.name}
            </span>
          ) : null,
        )}
      </div>
      <div className="h-64 w-full sm:h-80" role="img" aria-label="Line chart of readiness and Investor Room scores over time. The same data is in the table below.">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 24, bottom: 4, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[min - pad, max + pad]}
              tickFormatter={(t: number) => dayFormat.format(new Date(t))}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
              minTickGap={24}
              allowDuplicatedCategory={false}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 50, 70, 85, 100]}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            {BANDS.map((b) => (
              <ReferenceLine
                key={b.y}
                y={b.y}
                stroke="var(--muted-foreground)"
                strokeOpacity={0.35}
                strokeDasharray="3 4"
                label={{ value: b.label, position: "insideTopLeft", fill: "var(--muted-foreground)", fontSize: 10, offset: 6 }}
              />
            ))}
            <Tooltip content={(props) => <TooltipBody {...(props as TooltipContentProps<number, string>)} />} cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.4 }} />
            {SERIES.map((s) =>
              data[s.key].length ? (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  connectNulls
                  name={s.name}
                  type="linear"
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 4, fill: s.color, stroke: "var(--background)", strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: "var(--background)", strokeWidth: 2 }}
                  isAnimationActive={false}
                  label={(props: { x?: number | string; y?: number | string; index?: number; value?: unknown }) =>
                    props.index === lastIndex(rows, s.key) ? (
                      <text x={Number(props.x)} y={Number(props.y) - 10} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--foreground)">
                        {String(props.value ?? "")}
                      </text>
                    ) : (
                      <g />
                    )
                  }
                />
              ) : null,
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="text-muted-foreground text-xs">
        {latest(readiness) ? `Latest readiness score ${latest(readiness)!.score}. ` : ""}
        {latest(meetings) ? `Latest Investor Room score ${latest(meetings)!.score}.` : ""}
      </figcaption>
    </figure>
  );
}
