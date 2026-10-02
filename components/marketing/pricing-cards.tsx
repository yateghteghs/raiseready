import Link from "next/link";
import { CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CREDIT_PACKS, DECK_BUILDER, FREE_PLAN, PLAN_LIMITS, PRO_PLAN, PRO_PLUS_PLAN } from "@/lib/billing/plans";
import { PRICES, usdEnabled } from "@/lib/billing/prices";
import { formatMoney, koboToNaira } from "@/lib/format";
import type { Messages } from "@/lib/i18n/messages/en";
import { fill } from "@/lib/i18n/text";
import { cn } from "@/lib/utils";

const naira = (kobo: number) => formatMoney(koboToNaira(kobo));
const usd = (cents: number) => formatMoney(cents / 100, "USD");

type Tier = {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  badge?: string;
  highlighted?: boolean;
};

export function PricingCards({ t }: { t: Messages["pricing"] }) {
  const tiers: Tier[] = [
    {
      name: t.free.name,
      price: naira(FREE_PLAN.priceKobo),
      period: "",
      description: t.free.description,
      features: t.free.features.map((f) =>
        fill(f, { assessments: FREE_PLAN.assessments, simulations: FREE_PLAN.simulations, slides: DECK_BUILDER.previewSlides }),
      ),
      cta: t.free.cta,
      href: "/register",
    },
    {
      name: t.pro.name,
      price: naira(PRO_PLAN.priceKobo),
      period: t.perMonth,
      description: t.pro.description,
      features: t.pro.features.map((f) => fill(f, { simulations: PLAN_LIMITS.pro.simulationsPerMonth, decks: PLAN_LIMITS.pro.decksPerMonth })),
      cta: t.pro.cta,
      href: "/register",
      badge: t.mostPopular,
      highlighted: true,
    },
    {
      name: t.plus.name,
      price: naira(PRO_PLUS_PLAN.priceKobo),
      period: t.perMonth,
      description: t.plus.description,
      features: t.plus.features.map((f) =>
        fill(f, {
          simulations: PLAN_LIMITS.pro_plus.simulationsPerMonth,
          decks: PLAN_LIMITS.pro_plus.decksPerMonth,
          rewrites: PLAN_LIMITS.pro_plus.rewritesPerDeck,
        }),
      ),
      cta: t.plus.cta,
      href: "/register",
      badge: t.premium,
    },
    {
      name: t.teams.name,
      price: t.teams.price,
      period: "",
      description: t.teams.description,
      features: t.teams.features,
      cta: t.teams.cta,
      href: "/teams",
    },
  ];
  const payg = [
    ...CREDIT_PACKS.map((p) => fill(t.credits.pack, { price: naira(p.priceKobo), simulations: p.simulations })),
    fill(t.credits.deck, { price: naira(DECK_BUILDER.priceKobo) }),
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={cn("bg-card flex flex-col rounded-xl border p-6", tier.highlighted && "border-primary ring-primary/20 ring-4")}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">{tier.name}</h3>
              {tier.badge ? (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    tier.highlighted ? "bg-primary text-primary-foreground" : "bg-foreground text-background",
                  )}
                >
                  {tier.badge}
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-1 text-sm">{tier.description}</p>
            <p className="mt-6">
              <span className="text-3xl font-semibold tracking-tight" dir="ltr">
                {tier.price}
              </span>
              {tier.period ? <span className="text-muted-foreground ms-1 text-sm">{tier.period}</span> : null}
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
              <Link href={tier.href}>{tier.cta}</Link>
            </Button>
          </div>
        ))}
      </div>

      <div className="bg-muted/40 flex flex-col gap-4 rounded-xl border p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-semibold">{t.paygTitle}</h3>
          <p className="text-muted-foreground text-sm">{t.credits.description}</p>
        </div>
        <ul className="grid gap-2 text-sm sm:grid-cols-3 md:gap-6">
          {payg.map((f) => (
            <li key={f} className="flex gap-2">
              <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {usdEnabled() ? (
        <p className="text-muted-foreground text-sm">
          {fill(t.usdNote, {
            pro: usd(PRICES.USD.pro_monthly),
            packs: [
              `${t.plus.name} ${usd(PRICES.USD.pro_plus_monthly)}`,
              ...CREDIT_PACKS.map((p) => fill(t.usdPack, { simulations: p.simulations, price: usd(PRICES.USD[p.product]) })),
              fill(t.credits.deck, { price: usd(PRICES.USD.deck_builder) }),
            ].join(", "),
          })}
        </p>
      ) : null}
    </div>
  );
}
