/**
 * Small server-rendered charts for the admin area. One series each, so no
 * legend: the section title names it. Hover or focus a bar for its value;
 * every chart has a table version for screen readers and exact numbers.
 */

const dayLabel = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "UTC" });

export function DailyBars({ series, label }: { series: { day: string; users: number }[]; label: string }) {
  const max = Math.max(1, ...series.map((d) => d.users));
  return (
    <figure className="grid gap-2">
      <div className="flex h-40 items-end gap-0.5 border-b" role="img" aria-label={`${label}, last ${series.length} days`}>
        {series.map((d) => (
          <div key={d.day} tabIndex={0} className="group relative flex h-full flex-1 items-end outline-none" aria-label={`${dayLabel.format(new Date(d.day))}: ${d.users}`}>
            <div
              className="w-full rounded-t-[4px] bg-chart-1 group-hover:opacity-80 group-focus-visible:opacity-80"
              style={{ height: d.users ? `${Math.max(3, (d.users / max) * 100)}%` : "0" }}
            />
            <span className="bg-popover text-popover-foreground pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded border px-2 py-1 text-xs whitespace-nowrap shadow-sm group-hover:block group-focus-visible:block">
              {dayLabel.format(new Date(d.day))}: <strong>{d.users}</strong>
            </span>
          </div>
        ))}
      </div>
      <figcaption className="text-muted-foreground flex justify-between text-xs">
        <span>{dayLabel.format(new Date(series[0].day))}</span>
        <span>Peak {max === 1 && !series.some((d) => d.users) ? 0 : max} a day</span>
        <span>{dayLabel.format(new Date(series[series.length - 1].day))}</span>
      </figcaption>
      <details className="text-sm">
        <summary className="text-muted-foreground cursor-pointer text-xs">Show as a table</summary>
        <table className="mt-2 text-xs">
          <caption className="sr-only">{label} by day</caption>
          <thead>
            <tr>
              <th className="pr-6 text-left font-medium">Day</th>
              <th className="text-right font-medium">Founders</th>
            </tr>
          </thead>
          <tbody>
            {series.map((d) => (
              <tr key={d.day}>
                <td className="pr-6">{dayLabel.format(new Date(d.day))}</td>
                <td className="text-right tabular-nums">{d.users}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export function FunnelBars({ steps }: { steps: { label: string; count: number; ofSignups: number; fromPrevious: number }[] }) {
  return (
    <ol className="grid gap-3">
      {steps.map((s, i) => (
        <li key={s.label} className="grid gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{s.label}</span>
            <span className="text-muted-foreground tabular-nums">
              <span className="text-foreground font-medium">{s.count.toLocaleString("en-NG")}</span> · {Math.round(s.ofSignups * 100)}% of sign-ups
              {i > 0 ? ` · ${Math.round(s.fromPrevious * 100)}% of previous step` : ""}
            </span>
          </div>
          <div className="bg-muted h-2.5 rounded-[4px]">
            <div className="h-full rounded-[4px] bg-chart-1" style={{ width: `${Math.round(s.ofSignups * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
