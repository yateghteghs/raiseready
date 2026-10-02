"use client";

import { CheckIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkCodeAction, checkoutAction, type CodePreview } from "@/lib/billing/actions";
import type { Currency } from "@/lib/billing/prices";
import { formatMoney } from "@/lib/format";
import type { PaymentProduct } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export type BuyOption = {
  product: PaymentProduct;
  title: string;
  perMonth?: boolean;
  features?: string[];
  note?: string;
  highlight?: boolean;
  buttonLabel: string;
  prices: Record<Currency, number>;
};

const money = (minor: number, currency: Currency) => formatMoney(minor / 100, currency);

/** Plans and credit packs with a currency choice and a discount-code box. Prices are re-checked on the server at checkout. */
export function BuyOptions({ options, currencies, referralPercent }: { options: BuyOption[]; currencies: Currency[]; referralPercent: number | null }) {
  const [currency, setCurrency] = useState<Currency>(currencies[0]);
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<CodePreview | null>(null);
  const [checking, startCheck] = useTransition();
  const [buying, startBuy] = useTransition();
  const [buyingProduct, setBuyingProduct] = useState<PaymentProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const applied = preview?.ok ? code : "";

  const check = () =>
    startCheck(async () => {
      setError(null);
      setPreview(await checkCodeAction(code, currency));
    });

  const buy = (product: PaymentProduct) =>
    startBuy(async () => {
      setError(null);
      setBuyingProduct(product);
      const result = await checkoutAction(product, { currency, code: applied || undefined });
      if (result?.error) setError(result.error);
      setBuyingProduct(null);
    });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        {currencies.length > 1 ? (
          <fieldset className="grid gap-1">
            <legend className="text-muted-foreground text-xs">Pay in</legend>
            <div className="flex gap-1">
              {currencies.map((c) => (
                <Button
                  key={c}
                  type="button"
                  size="sm"
                  variant={c === currency ? "default" : "outline"}
                  aria-pressed={c === currency}
                  onClick={() => {
                    setCurrency(c);
                    setPreview(null);
                  }}
                >
                  {c === "NGN" ? "₦ Naira" : "$ US dollars"}
                </Button>
              ))}
            </div>
          </fieldset>
        ) : null}
        <form
          className="grid gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
        >
          <label htmlFor="discount-code" className="text-muted-foreground text-xs">
            Discount code
          </label>
          <div className="flex gap-2">
            <Input
              id="discount-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setPreview(null);
              }}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              className="w-40 uppercase"
            />
            <Button type="submit" size="sm" variant="outline" disabled={!code.trim() || checking}>
              {checking ? "Checking…" : "Apply"}
            </Button>
          </div>
        </form>
      </div>
      <div aria-live="polite" className="text-sm">
        {preview?.ok ? (
          <p className="text-primary font-medium">Code applied: up to {preview.percentOff}% off. New prices are shown below.</p>
        ) : preview && !preview.ok ? (
          <p className="text-destructive">{preview.error}</p>
        ) : referralPercent ? (
          <p className="text-muted-foreground">You were invited by another founder: {referralPercent}% off your first purchase, applied at checkout.</p>
        ) : null}
        {error ? (
          <p role="alert" className="text-destructive mt-1">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {options.map((o) => {
          const list = o.prices[currency];
          const deal = preview?.ok ? preview.prices[o.product] : undefined;
          return (
            <div
              key={o.product}
              className={cn("bg-card flex flex-col gap-3 rounded-xl border p-5", o.highlight && "border-primary ring-primary/20 ring-4")}
            >
              <h3 className="font-semibold">{o.title}</h3>
              <p>
                {deal && deal.amount < list ? (
                  <>
                    <span className="text-3xl font-semibold">{deal.amount === 0 ? "Free" : money(deal.amount, currency)}</span>{" "}
                    <s className="text-muted-foreground text-sm">{money(list, currency)}</s>
                  </>
                ) : (
                  <span className="text-3xl font-semibold">{money(list, currency)}</span>
                )}
                {o.perMonth ? <span className="text-muted-foreground text-sm"> / month</span> : null}
              </p>
              {o.perMonth && deal && deal.amount < list ? (
                <p className="text-muted-foreground text-xs">Discount applies to your first month; then {money(list, currency)} a month.</p>
              ) : null}
              {preview?.ok && !deal ? <p className="text-muted-foreground text-xs">This code doesn&apos;t apply here.</p> : null}
              {o.features ? (
                <ul className="grid gap-2 text-sm">
                  {o.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
              ) : null}
              {o.note ? <p className="text-muted-foreground text-sm">{o.note}</p> : null}
              <div className="mt-auto">
                <Button type="button" variant={o.highlight ? "default" : "outline"} disabled={buying} onClick={() => buy(o.product)}>
                  {buying && buyingProduct === o.product ? "Opening Paystack…" : o.buttonLabel}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
