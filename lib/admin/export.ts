import { lagosDay } from "@/lib/activity/service";
import type { Staff } from "@/lib/admin/auth";
import { toCsv } from "@/lib/admin/csv";
import { paymentsList, simulationsList, usersList } from "@/lib/admin/data";
import { difficultyLabel, personaLabel, productLabel } from "@/lib/admin/labels";
import { roleLabel, STATUS_LABELS } from "@/lib/admin/permissions";
import { koboToNaira } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const EXPORT_KINDS = ["users", "simulations", "payments"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

const iso = (v: string | null | undefined) => (v ? v.slice(0, 19).replace("T", " ") : "");

/** Builds a CSV of a whole admin list and records who downloaded it. */
export async function exportCsv(staff: Staff, kind: ExportKind): Promise<{ csv: string; filename: string }> {
  let csv: string;
  let count: number;
  if (kind === "users") {
    const { rows } = await usersList({ all: true });
    count = rows.length;
    csv = toCsv(rows, [
      { header: "Email", value: (u) => u.email },
      { header: "Name", value: (u) => u.full_name },
      { header: "Country", value: (u) => u.country },
      { header: "Startup", value: (u) => u.startup?.name },
      { header: "Stage", value: (u) => u.startup?.stage },
      { header: "Status", value: (u) => STATUS_LABELS[u.status] ?? u.status },
      { header: "Role", value: (u) => roleLabel(u.role) },
      { header: "Plan", value: (u) => (u.plan === "pro" ? "Pro" : "Free") },
      { header: "Credits", value: (u) => u.credits },
      { header: "Onboarded", value: (u) => (u.onboarding_complete ? "Yes" : "No") },
      { header: "Joined (UTC)", value: (u) => iso(u.created_at) },
      { header: "Last seen (UTC)", value: (u) => iso(u.last_seen_at) },
    ]);
  } else if (kind === "simulations") {
    const { rows } = await simulationsList({ all: true });
    count = rows.length;
    csv = toCsv(rows, [
      { header: "Started (UTC)", value: (s) => iso(s.started_at) },
      { header: "Ended (UTC)", value: (s) => iso(s.ended_at) },
      { header: "Startup", value: (s) => s.startup },
      { header: "Investor", value: (s) => personaLabel(s.persona) },
      { header: "Difficulty", value: (s) => difficultyLabel(s.difficulty) },
      { header: "Type", value: (s) => (s.mode === "drill" ? "Drill" : "Full") },
      { header: "Status", value: (s) => s.status },
      { header: "Score", value: (s) => s.overall_score },
      { header: "Investor confidence", value: (s) => s.investor_confidence },
      { header: "Paid by", value: (s) => s.funded_by },
    ]);
  } else {
    const { rows } = await paymentsList({ all: true });
    count = rows.length;
    csv = toCsv(rows, [
      { header: "Date (UTC)", value: (p) => iso(p.created_at) },
      { header: "Email", value: (p) => p.email },
      { header: "Product", value: (p) => productLabel(p.product) },
      { header: "Amount", value: (p) => koboToNaira(p.amount_kobo) },
      { header: "Currency", value: (p) => p.currency },
      { header: "Status", value: (p) => p.status },
      { header: "Paystack reference", value: (p) => p.reference },
    ]);
  }
  // Exports contain personal data, so who downloaded what is logged.
  await createAdminClient()
    .from("audit_logs")
    .insert({ actor_id: staff.id, action: "admin.exported", target_type: "export", metadata: { kind, rows: count } });
  return { csv, filename: `raiseready-${kind}-${lagosDay()}.csv` };
}
