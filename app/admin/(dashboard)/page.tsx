import { num, PageTitle, pct, Stat, StatGrid, usd } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { overviewMetrics } from "@/lib/admin/data";
import { formatMoney, koboToNaira } from "@/lib/format";

export const metadata = { title: "Overview" };

export default async function AdminOverview() {
  await requireStaff();
  const m = await overviewMetrics();
  return (
    <>
      <PageTitle title="Overview" description="Everything at a glance. AI figures cover the last 30 days." />
      <section className="grid gap-3" aria-labelledby="users-h">
        <h2 id="users-h" className="font-semibold">Founders</h2>
        <StatGrid>
          <Stat label="Users" value={num(m.users)} hint={`${num(m.users7)} new this week · ${num(m.users30)} this month`} />
          <Stat label="Finished onboarding" value={pct(m.onboardingRate)} />
          <Stat label="Startups" value={num(m.startups)} />
          <Stat label="On Pro" value={num(m.pro)} />
        </StatGrid>
      </section>
      <section className="grid gap-3" aria-labelledby="usage-h">
        <h2 id="usage-h" className="font-semibold">Usage</h2>
        <StatGrid>
          <Stat label="Documents analysed" value={num(m.analysed)} hint="knowledge profile versions" />
          <Stat label="Assessments" value={num(m.assessments)} hint={m.avgAssessment !== null ? `average score ${m.avgAssessment}` : undefined} />
          <Stat label="Simulations started" value={num(m.simsStarted)} />
          <Stat
            label="Simulations completed"
            value={num(m.simsCompleted)}
            hint={`${m.simsStarted ? pct(m.simsCompleted / m.simsStarted) : "0%"} completion${m.avgSimulation !== null ? ` · average ${m.avgSimulation}` : ""}`}
          />
        </StatGrid>
      </section>
      <section className="grid gap-3" aria-labelledby="money-h">
        <h2 id="money-h" className="font-semibold">Revenue and AI cost</h2>
        <StatGrid>
          <Stat label="Revenue this month" value={formatMoney(koboToNaira(m.revenue.thisMonthKobo))} />
          <Stat label="Revenue all time" value={formatMoney(koboToNaira(m.revenue.allTimeKobo))} />
          <Stat label="AI calls (30 days)" value={num(m.ai.calls)} hint={`${pct(m.ai.failureRate)} failed`} />
          <Stat label="Estimated AI cost (30 days)" value={usd(m.ai.costUsd)} hint={m.ai.unpricedCalls ? `${m.ai.unpricedCalls} calls on unpriced models` : undefined} />
        </StatGrid>
      </section>
    </>
  );
}
