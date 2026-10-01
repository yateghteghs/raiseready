import { cn } from "@/lib/utils";

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {hint ? <dd className="text-muted-foreground mt-1 text-xs">{hint}</dd> : null}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">{children}</dl>;
}

export type Column<T> = { header: string; cell: (row: T) => React.ReactNode; align?: "right" };

export function Table<T>({ rows, columns, empty = "Nothing yet.", caption }: { rows: T[]; columns: Column<T>[]; empty?: string; caption: string }) {
  if (rows.length === 0) return <p className="text-muted-foreground text-sm">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/40 text-muted-foreground text-left text-xs">
          <tr>
            {columns.map((c) => (
              <th key={c.header} scope="col" className={cn("px-4 py-2 font-medium whitespace-nowrap", c.align === "right" && "text-right")}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.header} className={cn("px-4 py-2.5 whitespace-nowrap", c.align === "right" && "text-right tabular-nums")}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const usd = (x: number) => `$${x.toFixed(x < 10 ? 2 : 0)}`;
export const num = (x: number) => x.toLocaleString("en-NG");
export const adminDate = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });
