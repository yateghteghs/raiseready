import Link from "next/link";
import { CheckIcon } from "lucide-react";

import { CurrencySwitch } from "@/components/marketing/currency-switch";
import { Button } from "@/components/ui/button";
import { planFeatures } from "@/lib/billing/plan-features";
import type { PlanRules } from "@/lib/billing/plan-rules";
import { CREDIT_PACKS } from "@/lib/billing/plans";
import { priceLabel, type PriceContext } from "@/lib/currency/display";
import type { Messages } from "@/lib/i18n/messages/en";
import { fill } from "@/lib/i18n/text";
import { cn } from "@/lib/utils";

type Tier = {
  name: string;
  price: { price: string; approx: string | null } | null;
  customPrice?: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  badge?: string;
  highlighted?: boolean;
};

/**
 * The plan cards. Features come from the live plan rules and prices from the
 * live price list, in the visitor's currency (naira for Nigeria, US dollars
 * elsewhere), with an estimate in their own currency when a rate is set.
 */
export function PricingCards({ t, rules, ctx }: { t: Messages["pricing"]; rules: PlanRules; ctx: PriceContext }) {
  const p = (minor: number) => priceLabel(minor, ctx);
  const prices = ctx.prices[ctx.currency];
  const tiers: Tier[] = [
    {
      name: t.free.name,
      price: p(0),
      period: "",
      description: rules.free.description ?? t.free.description,
      features: planFeatures("free", rules, t.features),
      cta: t.free.cta,
      href: "/register",
    },
    {
      name: t.pro.name,
      price: p(prices.pro_monthly),
      period: t.perMonth,
      description: rules.pro.description ?? t.pro.description,
      features: planFeatures("pro", rules, t.features),
      cta: t.pro.cta,
      href: "/register",
      badge: t.mostPopular,
      highlighted: true,
    },
    {
      name: t.plus.name,
      price: p(prices.pro_plus_monthly),
      period: t.perMonth,
      description: rules.pro_plus.description ?? t.plus.description,
      features: planFeatures("pro_plus", rules, t.features),
      cta: t.plus.cta,
      href: "/register",
      badge: t.premium,
    },
    {
      name: t.teams.name,
      price: null,
      customPrice: t.teams.price,
      period: "",
      description: t.teams.description,
      features: t.teams.features,
      cta: t.teams.cta,
      href: "/teams",
    },
  ];
  const payg = [
    ...CREDIT_PACKS.map((pack) => ({ text: fill(t.credits.pack, { price: p(prices[pack.product]).price, simulations: pack.simulations }), approx: p(prices[pack.product]).approx })),
    { text: fill(t.credits.deck, { price: p(prices.deck_builder).price }), approx: p(prices.deck_builder).approx },
  ];
  const hasEstimates = Boolean(p(prices.pro_monthly).approx);
  const other = ctx.currency === "NGN" ? "USD" : "NGN";

  return (
    <div className="grid gap-6">
      <div className="text-muted-foreground flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span>{fill(t.pricesIn, { currency: t.currencyNames[ctx.currency] })}</span>
        {ctx.usdOn ? <CurrencySwitch to={other} label={fill(t.switchTo, { currency: t.currencyNames[other] })} /> : null}
      </div>
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
                {tier.price?.price ?? tier.customPrice}
              </span>
              {tier.period ? <span className="text-muted-foreground ms-1 text-sm">{tier.period}</span> : null}
            </p>
            {tier.price?.approx ? (
              <p className="text-muted-foreground mt-1 text-xs" dir="ltr">
                {tier.price.approx}
              </p>
            ) : null}
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
            <li key={f.text} className="flex gap-2">
              <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {f.text}
                {f.approx ? (
                  <span className="text-muted-foreground block text-xs" dir="ltr">
                    {f.approx}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {hasEstimates ? <p className="text-muted-foreground text-xs">{t.estimateNote}</p> : null}
    </div>
  );
}
