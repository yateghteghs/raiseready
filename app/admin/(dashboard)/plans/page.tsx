import { CheckIcon } from "lucide-react";
import Link from "next/link";

import { PlanForm } from "@/components/admin/plan-form";
import { PageTitle } from "@/components/admin/ui";
import { DIFFICULTIES, PERSONAS } from "@/lib/ai/personas";
import { requireStaff } from "@/lib/admin/auth";
import { planFeatures } from "@/lib/billing/plan-features";
import { ALL_DIFFICULTIES, ALL_PERSONAS, EDITABLE_PLANS, PLAN_NAMES } from "@/lib/billing/plan-rules";
import { getPlanRules } from "@/lib/billing/plan-settings";
import { DICTIONARIES } from "@/lib/i18n/messages";
import type { Plan } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Plans" };

export default async function AdminPlansPage({ searchParams }: PageProps<"/admin/plans">) {
  await requireStaff("manage_discounts", "/admin/plans");
  const { plan: requested } = await searchParams;
  const plan: Plan = EDITABLE_PLANS.includes(requested as Plan) ? (requested as Plan) : "free";
  const rules = await getPlanRules();
  const preview = planFeatures(plan, rules, DICTIONARIES.en.pricing.features);

  return (
    <>
      <PageTitle
        title="Plans"
        description="What each plan includes. The plan limits and the pricing cards both follow these settings, so the website never promises more than a plan gives. Prices are under Prices; Teams members get Pro Plus."
      />
      <nav aria-label="Plan" className="-mt-2 flex flex-wrap gap-2">
        {EDITABLE_PLANS.map((p) => (
          <Link
            key={p}
            href={`/admin/plans?plan=${p}`}
            aria-current={p === plan ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-sm", p === plan ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}
          >
            {PLAN_NAMES[p]}
          </Link>
        ))}
      </nav>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <PlanForm
          key={plan}
          plan={plan}
          rule={rules[plan]}
          personas={ALL_PERSONAS.map((p) => ({ value: p, label: PERSONAS[p].name }))}
          difficulties={ALL_DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTIES[d].label }))}
        />
        <aside className="bg-muted/40 grid content-start gap-3 rounded-xl border p-5">
          <p className="text-sm font-medium">On the pricing card now</p>
          <ul className="grid gap-2 text-sm">
            {preview.map((line) => (
              <li key={line} className="flex gap-2">
                <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">Updates after you save. Shown in each visitor&apos;s language.</p>
        </aside>
      </div>
    </>
  );
}
