import Link from "next/link";

import { num, PageTitle, pct, Stat, StatGrid, Table, usd } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { aiUsage } from "@/lib/admin/data";
import { purposeLabel } from "@/lib/admin/labels";
import type { UsageSummary } from "@/lib/admin/aggregate";
import { cn } from "@/lib/utils";

export const metadata = { title: "AI usage" };

const RANGES = [7, 30, 90];

const latency = (u: UsageSummary) => (u.avgLatencyMs === null ? "" : `${(u.avgLatencyMs / 1000).toFixed(1)}s`);
const cost = (u: UsageSummary) => `${usd(u.costUsd)}${u.unpricedCalls ? "*" : ""}`;

function columns(first: { header: string; cell: (u: UsageSummary) => React.ReactNode }) {
  return [
    first,
    { header: "Calls", cell: (u: UsageSummary) => num(u.calls), align: "right" as const },
    { header: "Failed", cell: (u: UsageSummary) => pct(u.failureRate), align: "right" as const },
    { header: "Input tokens", cell: (u: UsageSummary) => num(u.inputTokens), align: "right" as const },
    { header: "Output tokens", cell: (u: UsageSummary) => num(u.outputTokens), align: "right" as const },
    { header: "Avg latency", cell: latency, align: "right" as const },
    { header: "Est. cost", cell: cost, align: "right" as const },
  ];
}

export default async function AdminAiUsage({ searchParams }: PageProps<"/admin/ai-usage">) {
  await requireStaff();
  const requested = Number((await searchParams).days);
  const days = RANGES.includes(requested) ? requested : 30;
  const { summary, emails, truncated } = await aiUsage(days);
  const t = summary.total;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title="AI usage" description="Every model call, including retries. Costs are estimates from list prices." />
        <nav aria-label="Time range" className="flex gap-1 text-sm">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/ai-usage?days=${r}`}
              aria-current={r === days ? "page" : undefined}
              className={cn("rounded-md border px-3 py-1", r === days ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}
            >
              {r} days
            </Link>
          ))}
        </nav>
      </div>
      {truncated ? <p className="text-sm text-amber-700 dark:text-amber-400">Showing the most recent 20,000 calls only.</p> : null}
      <StatGrid>
        <Stat label="Calls" value={num(t.calls)} hint={`${pct(t.failureRate)} failed`} />
        <Stat label="Estimated cost" value={usd(t.costUsd)} hint={t.unpricedCalls ? `${t.unpricedCalls} calls on unpriced models` : undefined} />
        <Stat label="Tokens" value={num(t.inputTokens + t.outputTokens)} hint={`${num(t.inputTokens)} in · ${num(t.outputTokens)} out`} />
        <Stat label="Average latency" value={t.avgLatencyMs === null ? "–" : `${(t.avgLatencyMs / 1000).toFixed(1)}s`} />
      </StatGrid>
      {t.unpricedCalls ? <p className="text-muted-foreground text-xs">* Includes calls on models without a known price; those are left out of the cost.</p> : null}

      <section className="grid gap-3">
        <h2 className="font-semibold">By feature</h2>
        <Table caption="AI usage by feature" rows={summary.byPurpose} empty="No AI calls in this period." columns={columns({ header: "Feature", cell: (u) => purposeLabel(u.key) })} />
      </section>
      <section className="grid gap-3">
        <h2 className="font-semibold">By model</h2>
        <Table caption="AI usage by model" rows={summary.byModel} empty="No AI calls in this period." columns={columns({ header: "Model", cell: (u) => <code className="text-xs">{u.key}</code> })} />
      </section>
      <section className="grid gap-3">
        <h2 className="font-semibold">By day</h2>
        <Table caption="AI usage by day (UTC)" rows={summary.byDay} empty="No AI calls in this period." columns={columns({ header: "Day (UTC)", cell: (u) => u.key })} />
      </section>
      <section className="grid gap-3">
        <h2 className="font-semibold">Top users by cost</h2>
        <Table
          caption="Top users by AI cost"
          rows={summary.byUser.slice(0, 25)}
          empty="No AI calls in this period."
          columns={columns({ header: "User", cell: (u) => (u.key === "deleted" ? <span className="text-muted-foreground">deleted account</span> : emails.get(u.key) || u.key) })}
        />
      </section>
    </>
  );
}
