import { adminDate, PageTitle, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { simulationsList } from "@/lib/admin/data";
import { difficultyLabel, personaLabel } from "@/lib/admin/labels";

export const metadata = { title: "Simulations" };

const STATUS: Record<string, string> = { active: "In progress", completed: "Completed", abandoned: "Abandoned" };

export default async function AdminSimulations() {
  await requireAdmin();
  const sims = await simulationsList();
  return (
    <>
      <PageTitle title="Simulations" description={`${sims.length} most recent sessions (up to 200), including drills.`} />
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
    </>
  );
}
