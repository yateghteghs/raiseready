import { ALL_DIFFICULTIES, ALL_PERSONAS, type PlanRule, type PlanRules } from "@/lib/billing/plan-rules";
import { DECK_BUILDER } from "@/lib/billing/plans";
import type { Messages } from "@/lib/i18n/messages/en";
import { fill } from "@/lib/i18n/text";
import type { Plan } from "@/lib/supabase/database.types";

type Texts = Messages["pricing"]["features"];

function lines(plan: Plan, r: PlanRule, t: Texts): string[] {
  const out: string[] = [];
  const paid = plan !== "free";
  if (paid) out.push(t.assessmentsUnlimited);
  else if (r.assessments > 0) out.push(fill(r.assessments === 1 ? t.assessmentsOne : t.assessmentsMany, { n: r.assessments }));
  if (r.simulations > 0) {
    out.push(paid ? fill(t.simulationsMonthly, { n: r.simulations }) : fill(r.simulations === 1 ? t.simulationsOne : t.simulationsMany, { n: r.simulations }));
  }
  if (r.simulations > 0) {
    out.push(
      ALL_PERSONAS.every((p) => r.personas.includes(p))
        ? t.investorsAll
        : fill(t.investorsSome, { list: ALL_PERSONAS.filter((p) => r.personas.includes(p)).map((p) => t.personas[p]).join(t.listSeparator) }),
    );
    out.push(
      ALL_DIFFICULTIES.every((d) => r.difficulties.includes(d))
        ? t.difficultiesAll
        : fill(t.difficultiesSome, { list: ALL_DIFFICULTIES.filter((d) => r.difficulties.includes(d)).map((d) => t.difficulties[d]).join(t.listSeparator) }),
    );
  }
  if (paid && r.decksPerMonth > 0) {
    out.push(fill(t.decksMonthly, { n: r.decksPerMonth }));
    if (r.rewritesPerDeck > 0) out.push(fill(t.rewrites, { n: r.rewritesPerDeck }));
  }
  if (!paid && r.deckPreview) out.push(fill(t.deckPreview, { n: DECK_BUILDER.previewSlides }));
  if (r.pdfReports) out.push(t.pdf);
  if (r.progressTracking) out.push(t.progress);
  return out;
}

/** Whether plan `a` includes at least everything plan `b` does. */
function includesAll(a: PlanRule, b: PlanRule): boolean {
  return (
    b.personas.every((p) => a.personas.includes(p)) &&
    b.difficulties.every((d) => a.difficulties.includes(d)) &&
    a.simulations >= b.simulations &&
    a.decksPerMonth >= b.decksPerMonth &&
    a.rewritesPerDeck >= b.rewritesPerDeck &&
    (a.pdfReports || !b.pdfReports) &&
    (a.progressTracking || !b.progressTracking)
  );
}

/**
 * The feature list for a plan's card, generated from its rules so it always
 * matches what the plan allows. Pro Plus is shown as "Everything in Pro" plus
 * what's different, when that's true. Admins' extra lines come last.
 */
export function planFeatures(plan: Plan, rules: PlanRules, t: Texts): string[] {
  const own = lines(plan, rules[plan], t);
  if (plan === "pro_plus") {
    const pro = lines("pro", rules.pro, t);
    if (includesAll(rules.pro_plus, rules.pro)) {
      return [t.everythingInPro, ...own.filter((l) => !pro.includes(l)), t.premium, ...rules[plan].extras];
    }
    return [...own, t.premium, ...rules[plan].extras];
  }
  return [...own, ...rules[plan].extras];
}
