import { DiscountForm } from "@/components/admin/discount-form";
import { adminDate, PageTitle, Table } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/admin/auth";
import { toggleDiscountCodeAction } from "@/lib/billing/discount-actions";
import { listDiscountCodes } from "@/lib/billing/discount-codes";
import { REFERRAL } from "@/lib/billing/prices";

export const metadata = { title: "Discounts" };

const PRODUCT_SHORT: Record<string, string> = { pro_monthly: "Pro", credits_3: "3 credits", credits_10: "10 credits" };

export default async function DiscountsPage() {
  await requireStaff("manage_discounts", "/admin/discounts");
  const codes = await listDiscountCodes();
  return (
    <>
      <PageTitle
        title="Discounts"
        description={`Codes founders type on the Billing page. A code on Pro discounts the first month only; later months are full price. Referrals are automatic: invited founders get ${REFERRAL.friendPercentOff}% off their first purchase and the inviter gets ${REFERRAL.referrerCredits} credits.`}
      />
      <DiscountForm />
      <Table
        caption="Discount codes"
        rows={codes}
        empty="No codes yet."
        columns={[
          { header: "Code", cell: (c) => <code className="font-medium">{c.code}</code> },
          { header: "Off", cell: (c) => `${c.percent_off}%`, align: "right" },
          { header: "Applies to", cell: (c) => c.products.map((p) => PRODUCT_SHORT[p] ?? p).join(", ") },
          { header: "Used", cell: (c) => (c.max_redemptions ? `${c.used} of ${c.max_redemptions}` : String(c.used)), align: "right" },
          { header: "Last day", cell: (c) => (c.expires_at ? adminDate.format(new Date(c.expires_at)) : "No end") },
          {
            header: "Status",
            cell: (c) => c.status,
          },
          { header: "Note", cell: (c) => <span className="text-muted-foreground">{c.description ?? ""}</span> },
          {
            header: "",
            cell: (c) => (
              <form action={toggleDiscountCodeAction.bind(null, c.id, !c.active)}>
                <Button type="submit" size="sm" variant="ghost">
                  {c.active ? "Turn off" : "Turn on"}
                </Button>
              </form>
            ),
          },
        ]}
      />
    </>
  );
}
