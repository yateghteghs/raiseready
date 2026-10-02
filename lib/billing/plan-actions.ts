"use server";

import { getStaff } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { ALL_DIFFICULTIES, ALL_PERSONAS, EDITABLE_PLANS, planRuleSchema } from "@/lib/billing/plan-rules";
import { savePlanRule } from "@/lib/billing/plan-settings";
import { formValues, type FormState } from "@/lib/forms";
import type { Plan } from "@/lib/supabase/database.types";

const num = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? NaN : Number(v));

/** Saves what a plan includes. Checkbox groups arrive as repeated fields. */
export async function savePlanAction(plan: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await getStaff();
  if (!staff || !can(staff.profile.role, "manage_discounts")) return { status: "error", message: "Only a super admin can change plans." };
  if (!EDITABLE_PLANS.includes(plan as Plan)) return { status: "error", message: "Unknown plan." };
  const values = formValues(formData);
  const description = String(formData.get("description") ?? "").trim();
  const rule = {
    description: description || null,
    extras: String(formData.get("extras") ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
    assessments: plan === "free" ? num(formData.get("assessments")) : 0,
    simulations: num(formData.get("simulations")),
    personas: ALL_PERSONAS.filter((p) => formData.getAll("personas").includes(p)),
    difficulties: ALL_DIFFICULTIES.filter((d) => formData.getAll("difficulties").includes(d)),
    decksPerMonth: plan === "free" ? 0 : num(formData.get("decksPerMonth")),
    rewritesPerDeck: plan === "free" ? 0 : num(formData.get("rewritesPerDeck")),
    deckPreview: plan === "free" ? formData.get("deckPreview") === "on" : true,
    pdfReports: formData.get("pdfReports") === "on",
    progressTracking: formData.get("progressTracking") === "on",
  };
  const parsed = planRuleSchema.safeParse(rule);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] ??= [
        key === "personas"
          ? "Choose at least one investor."
          : key === "difficulties"
            ? "Choose at least one difficulty."
            : key === "extras"
              ? "Up to 4 extra lines, each under 120 characters."
              : key === "description"
                ? "Keep it under 120 characters."
                : "Enter a whole number in the allowed range.",
      ];
    }
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors, values };
  }
  try {
    await savePlanRule(staff, plan as Plan, parsed.data);
  } catch (error) {
    console.error("[plans] save failed:", error);
    return { status: "error", message: "Something went wrong. Nothing was saved.", values };
  }
  return { status: "success", message: "Saved. The website, Billing page and plan limits use it straight away." };
}
