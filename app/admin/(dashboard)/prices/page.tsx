import { FxRates } from "@/components/admin/fx-rates";
import { PriceForm } from "@/components/admin/price-form";
import { PageTitle } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { productLabel } from "@/lib/admin/labels";
import { getPrices } from "@/lib/billing/price-settings";
import { DEFAULT_PRICES, PRICED_PRODUCTS, usdEnabled } from "@/lib/billing/prices";
import { listFxRates } from "@/lib/currency/fx";
import { formatMoney } from "@/lib/format";

export const metadata = { title: "Prices" };

const NOTES: Record<string, string> = {
  pro_monthly: "Monthly subscription",
  pro_plus_monthly: "Monthly subscription",
  credits_3: "One-off",
  credits_10: "One-off",
  deck_builder: "One-off",
};

export default async function AdminPricesPage() {
  await requireStaff("manage_discounts", "/admin/prices");
  const [prices, rates] = await Promise.all([getPrices(), listFxRates()]);
  const defaults = PRICED_PRODUCTS.map(
    (p) => `${productLabel(p)} ${formatMoney(DEFAULT_PRICES.NGN[p] / 100)} / ${formatMoney(DEFAULT_PRICES.USD[p] / 100, "USD")}`,
  ).join(" · ");

  return (
    <>
      <PageTitle
        title="Prices"
        description="What each plan and pack costs. Changes show on the website and Billing page straight away and apply to new purchases."
      />
      <div className="bg-muted/40 grid gap-2 rounded-xl border p-4 text-sm">
        <p>
          <span className="font-medium">Subscribers keep their price.</span> Changing Pro or Pro Plus creates a new plan in Paystack for
          new subscribers; people already subscribed carry on at the price they signed up for until they cancel.
        </p>
        <p>Discount codes and invite discounts are taken off these prices at checkout.</p>
        <p className="text-muted-foreground text-xs">Defaults: {defaults}.</p>
      </div>
      <PriceForm
        usdOn={usdEnabled()}
        rows={PRICED_PRODUCTS.map((p) => ({ product: p, label: productLabel(p), note: NOTES[p], NGN: prices.NGN[p], USD: prices.USD[p] }))}
      />
      <section className="grid gap-3 pt-4">
        <div>
          <h2 className="text-lg font-semibold">Exchange rates</h2>
          <p className="text-muted-foreground text-sm">
            Nigerians see naira. Everyone else sees US dollars plus an approximate amount in their own currency when a rate is set here
            (for example KES, GHS, ZAR, EGP). Founders are always charged in naira or dollars; these rates only change the estimate.
            {usdEnabled() ? "" : " Dollar payments are off, so everyone sees naira; add NGN to convert naira prices into local estimates."}
          </p>
        </div>
        <FxRates rates={rates.map((r) => ({ currency: r.currency, per_usd: Number(r.per_usd), updated_at: r.updated_at }))} />
      </section>
    </>
  );
}
