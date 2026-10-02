import { PERSONAS, DIFFICULTIES } from "@/lib/ai/personas";
import { CREDIT_PACKS, DECK_BUILDER, PRO_PLAN, PRO_PLUS_PLAN } from "@/lib/billing/plans";
import type { Difficulty, Persona } from "@/lib/supabase/database.types";

/** Display labels for admin tables. */
export const personaLabel = (p: string) => PERSONAS[p as Persona]?.name ?? p;
export const planLabel = (plan: string) => (plan === "pro_plus" ? "Pro Plus" : plan === "pro" ? "Pro" : "Free");
export const difficultyLabel = (d: string) => DIFFICULTIES[d as Difficulty]?.label ?? d;

export function productLabel(product: string) {
  if (product === PRO_PLAN.product) return `${PRO_PLAN.name} (monthly)`;
  if (product === PRO_PLUS_PLAN.product) return `${PRO_PLUS_PLAN.name} (monthly)`;
  if (product === DECK_BUILDER.product) return DECK_BUILDER.name;
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
  deck: "Pitch deck",
  deck_rewrite: "Slide rewrite",
  simulation_turn: "Investor turn",
  simulation_final: "Simulation feedback",
  simulation_drill: "Drill",
};
export const purposeLabel = (p: string) => PURPOSE_LABELS[p] ?? p.replaceAll("_", " ");
