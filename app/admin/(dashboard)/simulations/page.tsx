import { ExportButton } from "@/components/admin/export-button";
import { Pager, pageParam } from "@/components/admin/pager";
import { adminDate, PageTitle, Table } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { PAGE_SIZE, simulationsList } from "@/lib/admin/data";
import { can } from "@/lib/admin/permissions";
import { difficultyLabel, personaLabel } from "@/lib/admin/labels";

export const metadata = { title: "Simulations" };

const STATUS: Record<string, string> = { active: "In progress", completed: "Completed", abandoned: "Abandoned" };

export default async function AdminSimulations({ searchParams }: PageProps<"/admin/simulations">) {
  const staff = await requireStaff("view", "/admin/simulations");
  const page = pageParam((await searchParams).page);
  const { rows: sims, total } = await simulationsList({ page });
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title="Simulations" description="Practice meetings and drills, newest first." />
        {can(staff.profile.role, "export") ? <ExportButton kind="simulations" /> : null}
      </div>
      <Table
        caption="Simulations"
        rows={sims}
        empty="No simulations yet."
        columns={[
          { header: "Started", cell: (s) => adminDate.format(new Date(s.started_at)) },
          { header: "Startup", cell: (s) => s.startup },
          { header: "Investor", cell: (s) => personaLabel(s.persona) },
          { header: "Difficulty", cell: (s) => difficultyLabel(s.difficulty) },
          { header: "Type", cell: (s) => (s.mode === "drill" ? "Drill" : "Full") },
          { header: "Status", cell: (s) => STATUS[s.status] ?? s.status },
          { header: "Score", cell: (s) => s.overall_score ?? "", align: "right" },
          { header: "Confidence", cell: (s) => s.investor_confidence ?? "", align: "right" },
          { header: "Paid by", cell: (s) => (s.funded_by === "credit" ? "Credit" : s.funded_by === "pro" ? "Pro" : s.funded_by === "free" ? "Free" : "") },
        ]}
      />
      <Pager page={page} total={total} pageSize={PAGE_SIZE} path="/admin/simulations" />
    </>
  );
}
