import { ExportButton } from "@/components/admin/export-button";
import { RecheckPayment } from "@/components/admin/recheck-payment";
import { Pager, pageParam } from "@/components/admin/pager";
import { adminDate, num, PageTitle, Stat, StatGrid, Table } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { PAGE_SIZE, paymentsList } from "@/lib/admin/data";
import { can } from "@/lib/admin/permissions";
import { productLabel } from "@/lib/admin/labels";
import { formatMoney, koboToNaira } from "@/lib/format";

export const metadata = { title: "Payments" };

const STATUS: Record<string, string> = { pending: "Pending", success: "Paid", failed: "Failed", abandoned: "Abandoned", reversed: "Reversed" };

export default async function AdminPayments({ searchParams }: PageProps<"/admin/payments">) {
  const staff = await requireStaff("view", "/admin/payments");
  const page = pageParam((await searchParams).page);
  const { rows, total, summary, summaryUsd } = await paymentsList({ page });
  const canRecheck = can(staff.profile.role, "grant_credits");
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title="Payments" description="Successful Paystack payments count towards revenue. Newest first. If a founder was charged but the payment isn't marked Paid, use Check with Paystack." />
        {can(staff.profile.role, "export") ? <ExportButton kind="payments" /> : null}
      </div>
      <StatGrid>
        <Stat label="This month" value={formatMoney(koboToNaira(summary.thisMonthKobo))} />
        <Stat label="All time" value={formatMoney(koboToNaira(summary.allTimeKobo))} />
        {summaryUsd.allTimeKobo ? (
          <>
            <Stat label="This month (USD)" value={formatMoney(summaryUsd.thisMonthKobo / 100, "USD")} />
            <Stat label="All time (USD)" value={formatMoney(summaryUsd.allTimeKobo / 100, "USD")} />
          </>
        ) : null}
        {summary.byProduct.map((p) => (
          <Stat key={p.product} label={productLabel(p.product)} value={formatMoney(koboToNaira(p.kobo))} hint={`${num(p.count)} paid in naira`} />
        ))}
      </StatGrid>
      <Table
        caption="Payments"
        rows={rows}
        empty="No payments yet."
        columns={[
          { header: "Date", cell: (p) => adminDate.format(new Date(p.created_at)) },
          { header: "Email", cell: (p) => p.email || <span className="text-muted-foreground">unknown</span> },
          { header: "Product", cell: (p) => productLabel(p.product) },
          { header: "Amount", cell: (p) => formatMoney(koboToNaira(p.amount_kobo), p.currency), align: "right" },
          { header: "Status", cell: (p) => STATUS[p.status] ?? p.status },
          { header: "Reference", cell: (p) => <code className="text-xs">{p.reference}</code> },
          ...(canRecheck
            ? [{ header: "", cell: (p: (typeof rows)[number]) => (p.status === "success" ? null : <RecheckPayment reference={p.reference} />) }]
            : []),
        ]}
      />
      <Pager page={page} total={total} pageSize={PAGE_SIZE} path="/admin/payments" />
    </>
  );
}
