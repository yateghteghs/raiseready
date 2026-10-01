import { PERSONAS, DIFFICULTIES } from "@/lib/ai/personas";
import { CREDIT_PACKS, PRO_PLAN } from "@/lib/billing/plans";
import type { Difficulty, Persona } from "@/lib/supabase/database.types";

/** Display labels for admin tables. */
export const personaLabel = (p: string) => PERSONAS[p as Persona]?.name ?? p;
export const difficultyLabel = (d: string) => DIFFICULTIES[d as Difficulty]?.label ?? d;

export function productLabel(product: string) {
  if (product === PRO_PLAN.product) return `${PRO_PLAN.name} (monthly)`;
  return CREDIT_PACKS.find((p) => p.product === product)?.name ?? product;
}

const RED_FLAG_LABELS: Record<string, string> = {
  contradiction: "Contradictions",
  unsupported_claim: "Unsupported claims",
  weak_answer: "Weak answers",
  missing_info: "Missing information",
};
export const redFlagLabel = (t: string) => RED_FLAG_LABELS[t] ?? t;

const PURPOSE_LABELS: Record<string, string> = {
  extraction: "Document analysis",
  assessment: "Assessment",
  report: "Report",
  simulation_turn: "Investor turn",
  simulation_final: "Simulation feedback",
  simulation_drill: "Drill",
};
export const purposeLabel = (p: string) => PURPOSE_LABELS[p] ?? p.replaceAll("_", " ");
