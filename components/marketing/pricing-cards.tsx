import Link from "next/link";
import { CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CREDIT_PACKS, FREE_PLAN, PRO_PLAN } from "@/lib/billing/plans";
import { formatMoney, koboToNaira } from "@/lib/format";
import { cn } from "@/lib/utils";

const naira = (kobo: number) => formatMoney(koboToNaira(kobo));

const TIERS = [
  {
    name: FREE_PLAN.name,
    price: naira(FREE_PLAN.priceKobo),
    period: "",
    description: "Try the full loop once.",
    features: [
      `${FREE_PLAN.assessments} readiness assessment`,
      `${FREE_PLAN.simulations} Investor Room simulation`,
      "Angel or Seed VC investor",
      "Friendly or analytical difficulty",
    ],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: PRO_PLAN.name,
    price: naira(PRO_PLAN.priceKobo),
    period: `/ ${PRO_PLAN.interval}`,
    description: "For founders actively raising.",
    features: [
      "Unlimited readiness assessments",
      `Up to ${PRO_PLAN.simulationsPerMonth} simulations a month`,
      "All investors, including Grant Evaluator",
      "All difficulties, including tough",
      "Downloadable PDF reports",
      "Progress tracking over time",
    ],
    cta: "Get started",
    highlighted: true,
  },
  {
    name: "Credits",
    price: `From ${naira(CREDIT_PACKS[0].priceKobo)}`,
    period: "",
    description: "Pay as you go. No subscription.",
    features: CREDIT_PACKS.map((p) => `${naira(p.priceKobo)} for ${p.simulations} simulations`),
    cta: "Get started",
    highlighted: false,
  },
];

export function PricingCards() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {TIERS.map((tier) => (
        <div
          key={tier.name}
          className={cn(
            "bg-card flex flex-col rounded-xl border p-6",
            tier.highlighted && "border-primary ring-primary/20 ring-4",
          )}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{tier.name}</h3>
            {tier.highlighted ? (
              <span className="bg-primary text-primary-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                Most popular
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{tier.description}</p>
          <p className="mt-6">
            <span className="text-3xl font-semibold tracking-tight">{tier.price}</span>
            {tier.period ? <span className="text-muted-foreground ml-1 text-sm">{tier.period}</span> : null}
          </p>
          <ul className="mt-6 grid flex-1 content-start gap-3 text-sm">
            {tier.features.map((f) => (
              <li key={f} className="flex gap-2">
                <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
          <Button asChild className="mt-8" variant={tier.highlighted ? "default" : "outline"}>
            <Link href="/register">{tier.cta}</Link>
          </Button>
        </div>
      ))}
    </div>
  );
}
