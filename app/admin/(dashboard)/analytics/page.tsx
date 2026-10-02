import { DailyBars, FunnelBars } from "@/components/admin/charts";
import { num, PageTitle, Stat, StatGrid, Table } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { analytics } from "@/lib/admin/data";
import { purposeLabel } from "@/lib/admin/labels";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  await requireStaff("view", "/admin/analytics");
  const a = await analytics();
  const biggestDrop = a.funnel.slice(1).reduce((worst, s) => (s.fromPrevious < worst.fromPrevious ? s : worst), a.funnel[1] ?? a.funnel[0]);
  return (
    <>
      <PageTitle
        title="Analytics"
        description="How founders use RaiseReady. Activity counts a founder once per day they open the app (Lagos time). Records are kept for 90 days."
      />
      <StatGrid>
        <Stat label="Active today" value={num(a.active.daily)} />
        <Stat label="Active this week" value={num(a.active.weekly)} hint="last 7 days" />
        <Stat label="Active this month" value={num(a.active.monthly)} hint="last 30 days" />
        <Stat label="Sign-ins (30 days)" value={num(a.signIns)} hint={a.failedSignIns ? `${num(a.failedSignIns)} failed attempts` : "no failed attempts"} />
      </StatGrid>

      <section className="grid gap-3" aria-labelledby="daily-h">
        <h2 id="daily-h" className="font-semibold">Active founders per day</h2>
        <DailyBars series={a.active.series} label="Active founders per day" />
      </section>

      <section className="grid gap-3" aria-labelledby="funnel-h">
        <div>
          <h2 id="funnel-h" className="font-semibold">Where founders drop off</h2>
          <p className="text-muted-foreground text-sm">
            All founders since launch.
            {biggestDrop && a.funnel[0]?.count
              ? ` Biggest drop: before “${biggestDrop.label}” (${Math.round(biggestDrop.fromPrevious * 100)}% carry on from the step before).`
              : ""}
          </p>
        </div>
        <FunnelBars steps={a.funnel} />
      </section>

      <section className="grid gap-3" aria-labelledby="features-h">
        <h2 id="features-h" className="font-semibold">Features used (30 days)</h2>
        <Table
          caption="Feature use in the last 30 days"
          rows={a.features}
          empty="No AI features used in the last 30 days."
          columns={[
            { header: "Feature", cell: (f) => purposeLabel(f.purpose) },
            { header: "Founders", cell: (f) => num(f.founders), align: "right" },
            { header: "Uses", cell: (f) => num(f.uses), align: "right" },
          ]}
        />
        <p className="text-muted-foreground text-xs">Uses count every AI call, including automatic retries. Reports created in 30 days: {num(a.reports)}.</p>
      </section>
    </>
  );
}
