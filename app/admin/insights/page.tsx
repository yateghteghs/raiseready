import { num, PageTitle, pct, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { insights } from "@/lib/admin/data";
import { redFlagLabel } from "@/lib/admin/labels";

export const metadata = { title: "Insights" };

export default async function AdminInsights() {
  await requireAdmin();
  const data = await insights();
  return (
    <>
      <PageTitle
        title="Insights"
        description={`What startups most often lack, from the latest assessment of each of ${num(data.startups)} startups. Counts only, no founder content.`}
      />
      <section className="grid gap-3">
        <h2 className="font-semibold">Weakest dimensions</h2>
        <Table
          caption="Dimensions by number of startups scoring weak"
          rows={data.dimensions}
          empty="No assessments yet."
          columns={[
            { header: "Dimension", cell: (d) => d.name },
            { header: "Startups weak", cell: (d) => num(d.weak), align: "right" },
            { header: "Assessed", cell: (d) => num(d.assessed), align: "right" },
            { header: "Share weak", cell: (d) => (d.assessed ? pct(d.weak / d.assessed) : "–"), align: "right" },
            { header: "Average score", cell: (d) => d.average ?? "–", align: "right" },
          ]}
        />
      </section>
      <section className="grid gap-3">
        <h2 className="font-semibold">Most often missing</h2>
        <Table
          caption="Indicators most often not met"
          rows={data.indicators.slice(0, 20)}
          empty="No assessments yet."
          columns={[
            { header: "Indicator", cell: (i) => i.label },
            { header: "Dimension", cell: (i) => i.dimension },
            { header: "Not met", cell: (i) => num(i.notMet), align: "right" },
            { header: "Rated", cell: (i) => num(i.rated), align: "right" },
            { header: "Rate", cell: (i) => pct(i.rate), align: "right" },
          ]}
        />
      </section>
      <section className="grid gap-3">
        <h2 className="font-semibold">Red flags in simulations</h2>
        <Table
          caption="Red flags by type and severity"
          rows={data.redFlagTotal ? data.redFlags : []}
          empty="No red flags recorded yet."
          columns={[
            { header: "Type", cell: (f) => redFlagLabel(f.type) },
            { header: "Total", cell: (f) => num(f.total), align: "right" },
            { header: "High", cell: (f) => num(f.high), align: "right" },
            { header: "Medium", cell: (f) => num(f.medium), align: "right" },
            { header: "Low", cell: (f) => num(f.low), align: "right" },
          ]}
        />
      </section>
    </>
  );
}
