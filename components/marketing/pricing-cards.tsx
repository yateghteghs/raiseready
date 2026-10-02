import Link from "next/link";
import { CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CREDIT_PACKS, DECK_BUILDER, FREE_PLAN, PRO_PLAN } from "@/lib/billing/plans";
import { PRICES, usdEnabled } from "@/lib/billing/prices";
import { formatMoney, koboToNaira } from "@/lib/format";
import type { Messages } from "@/lib/i18n/messages/en";
import { fill } from "@/lib/i18n/text";
import { cn } from "@/lib/utils";

const naira = (kobo: number) => formatMoney(koboToNaira(kobo));
const usd = (cents: number) => formatMoney(cents / 100, "USD");

export function PricingCards({ t }: { t: Messages["pricing"] }) {
  const tiers = [
    {
      name: t.free.name,
      price: naira(FREE_PLAN.priceKobo),
      period: "",
      description: t.free.description,
      features: t.free.features.map((f) =>
        fill(f, { assessments: FREE_PLAN.assessments, simulations: FREE_PLAN.simulations, slides: DECK_BUILDER.previewSlides }),
      ),
      cta: t.free.cta,
      highlighted: false,
    },
    {
      name: t.pro.name,
      price: naira(PRO_PLAN.priceKobo),
      period: t.perMonth,
      description: t.pro.description,
      features: t.pro.features.map((f) => fill(f, { simulations: PRO_PLAN.simulationsPerMonth, decks: DECK_BUILDER.proDecksPerMonth })),
      cta: t.pro.cta,
      highlighted: true,
    },
    {
      name: t.credits.name,
      price: fill(t.credits.from, { price: naira(CREDIT_PACKS[0].priceKobo) }),
      period: "",
      description: t.credits.description,
      features: [
        ...CREDIT_PACKS.map((p) => fill(t.credits.pack, { price: naira(p.priceKobo), simulations: p.simulations })),
        fill(t.credits.deck, { price: naira(DECK_BUILDER.priceKobo) }),
      ],
      cta: t.credits.cta,
      highlighted: false,
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={cn("bg-card flex flex-col rounded-xl border p-6", tier.highlighted && "border-primary ring-primary/20 ring-4")}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{tier.name}</h3>
              {tier.highlighted ? (
                <span className="bg-primary text-primary-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">{t.mostPopular}</span>
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
              <Link href="/register">{tier.cta}</Link>
            </Button>
          </div>
        ))}
      </div>
      {usdEnabled() ? (
        <p className="text-muted-foreground text-sm">
          {fill(t.usdNote, {
            pro: usd(PRICES.USD.pro_monthly),
            packs: [
              ...CREDIT_PACKS.map((p) => fill(t.usdPack, { simulations: p.simulations, price: usd(PRICES.USD[p.product]) })),
              fill(t.credits.deck, { price: usd(PRICES.USD.deck_builder) }),
            ].join(", "),
          })}
        </p>
      ) : null}
    </div>
  );
}
