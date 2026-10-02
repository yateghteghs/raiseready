import { PriceForm } from "@/components/admin/price-form";
import { PageTitle } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { productLabel } from "@/lib/admin/labels";
import { getPrices } from "@/lib/billing/price-settings";
import { DEFAULT_PRICES, PRICED_PRODUCTS, usdEnabled } from "@/lib/billing/prices";
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
  const prices = await getPrices();
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
    </>
  );
}
