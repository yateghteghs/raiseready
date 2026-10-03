import Link from "next/link";

import { num, PageTitle, pct, Stat, StatGrid, usd } from "@/components/admin/ui";
import { TestEmailButton } from "@/components/admin/test-email";
import { requireStaff } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { emailConfigured } from "@/lib/email/mailtrap";
import { SITE } from "@/lib/site";
import { activeUserMetrics, overviewMetrics } from "@/lib/admin/data";
import { formatMoney, koboToNaira } from "@/lib/format";

export const metadata = { title: "Overview" };

export default async function AdminOverview() {
  const staff = await requireStaff();
  const [m, active] = await Promise.all([overviewMetrics(), activeUserMetrics()]);
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
          <Stat label="Active today" value={num(active.daily)} />
          <Stat label="Active this week" value={num(active.weekly)} />
          <Stat label="Active this month" value={num(active.monthly)} />
          <Stat
            label="More"
            value={
              <Link href="/admin/analytics" className="text-primary text-base underline-offset-4 hover:underline">
                See analytics
              </Link>
            }
            hint="drop-off and feature use"
          />
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
          <Stat
            label="Revenue all time"
            value={formatMoney(koboToNaira(m.revenue.allTimeKobo))}
            hint={m.revenueUsd.allTimeKobo ? `plus ${formatMoney(m.revenueUsd.allTimeKobo / 100, "USD")} in dollars` : undefined}
          />
          <Stat label="AI calls (30 days)" value={num(m.ai.calls)} hint={`${pct(m.ai.failureRate)} failed`} />
          <Stat label="Estimated AI cost (30 days)" value={usd(m.ai.costUsd)} hint={m.ai.unpricedCalls ? `${m.ai.unpricedCalls} calls on unpriced models` : undefined} />
        </StatGrid>
      </section>
      {can(staff.profile.role, "manage_content") ? (
        <section className="bg-card grid gap-3 rounded-xl border p-5" aria-labelledby="email-h">
          <h2 id="email-h" className="font-semibold">
            Email
          </h2>
          <p className="text-muted-foreground text-sm">
            {emailConfigured()
              ? `Connected to Mailtrap. Account emails (sign-up, password reset, sign-in links) come from ${SITE.email.system.name} <${SITE.email.system.email}>; staff invites and test emails from ${SITE.email.personal.name} <${SITE.email.personal.email}>.`
              : "Not set up: staff invite links are shown on screen for you to send. Add MAILTRAP_API_TOKEN in Vercel to email them automatically."}{" "}
            Every message appears in{" "}
            <a href="https://mailtrap.io/sending/email_logs" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              Mailtrap&apos;s Email Logs
            </a>
            .
          </p>
          {emailConfigured() ? <TestEmailButton /> : null}
        </section>
      ) : null}
    </>
  );
}
