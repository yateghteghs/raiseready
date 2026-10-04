import { DIFFICULTIES, PERSONAS } from "@/lib/ai/personas";
import { DEFAULT_PLAN_RULES, PLAN_NAMES, type PlanRule, type PlanRules } from "@/lib/billing/plan-rules";
import { DECK_BUILDER } from "@/lib/billing/plans";
import type { DeckAccess, Difficulty, PaidPlan, Persona, Plan, SubscriptionStatus } from "@/lib/supabase/database.types";

/**
 * Plan rules (spec section 7), as pure functions so they are easy to test.
 * Every AI operation checks these on the server first; the browser's idea of
 * the plan is never trusted.
 */

/** Grace period after a subscription's period end before Pro access stops. */
export const PRO_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export type SubscriptionInfo = { status: SubscriptionStatus; current_period_end: string | null } | null;

/** Whether a paid plan (Pro or Pro Plus) bought by the founder is still running. */
export function isProActive(plan: Plan, subscription: SubscriptionInfo, now = Date.now()): boolean {
  if (plan === "free") return false;
  if (!subscription) return true; // just paid; the subscription record arrives by webhook
  const end = subscription.current_period_end ? new Date(subscription.current_period_end).getTime() : null;
  if (end !== null && now > end + PRO_GRACE_MS) return false;
  return true;
}

export type Tier = "free" | PaidPlan;

/**
 * The founder's plan level: an active team gives Pro Plus; otherwise their
 * own subscription decides. The better of the two wins.
 */
export function tierOf(plan: Plan, subscription: SubscriptionInfo, team: { ends_at: string } | null, now = Date.now()): Tier {
  if (team && new Date(team.ends_at).getTime() > now) return "pro_plus";
  if (!isProActive(plan, subscription, now)) return "free";
  return plan === "pro_plus" ? "pro_plus" : "pro";
}

/** The paid plan whose allowances apply, or null on the free plan. */
export function paidPlanOf(usage: { proActive: boolean; tier?: Tier }): PaidPlan | null {
  const tier = usage.tier ?? (usage.proActive ? "pro" : "free");
  return tier === "free" ? null : tier;
}

export type Usage = {
  /** True on Pro or Pro Plus (bought or through a team). */
  proActive: boolean;
  /** Which plan; when missing, Pro if proActive. */
  tier?: Tier;
  /** What each plan includes (live settings); the defaults when missing. */
  rules?: PlanRules;
  credits: number;
  assessments: number;
  /** Simulations that used the one free allowance. */
  freeSimulationsUsed: number;
  /** Simulations covered by Pro or Pro Plus this calendar month. */
  proSimulationsThisMonth: number;
};

export type Access<Via extends string> = { ok: true; via: Via } | { ok: false; reason: string; upgrade: boolean };

/** The rules for the founder's current plan. */
export function ruleFor(usage: { proActive: boolean; tier?: Tier; rules?: PlanRules }): PlanRule {
  return (usage.rules ?? DEFAULT_PLAN_RULES)[paidPlanOf(usage) ?? "free"];
}

const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} or ${items.at(-1)}` : items[0]);

export function simulationAccess(usage: Usage, persona: Persona, difficulty: Difficulty): Access<"free" | "pro" | "credit"> {
  const paid = paidPlanOf(usage);
  const rule = ruleFor(usage);
  const name = PLAN_NAMES[paid ?? "free"];
  const allowed = rule.personas.includes(persona) && rule.difficulties.includes(difficulty);
  const used = paid ? usage.proSimulationsThisMonth : usage.freeSimulationsUsed;
  const left = used < rule.simulations;

  if (allowed && left) return paid ? { ok: true, via: "pro" } : { ok: true, via: "free" };
  // Credits pay for any investor and difficulty.
  if (usage.credits > 0) return { ok: true, via: "credit" };

  if (!allowed && left) {
    const investors = list(rule.personas.map((p) => `${/^[AEIOU]/.test(PERSONAS[p].name) ? "an" : "a"} ${PERSONAS[p].name}`));
    const levels = list(rule.difficulties.map((d) => DIFFICULTIES[d].label));
    return {
      ok: false,
      reason: `${name} includes ${investors} on ${levels} difficulty. Choose one of those, buy credits for any investor and difficulty, or upgrade.`,
      upgrade: true,
    };
  }
  if (paid) {
    return {
      ok: false,
      reason: `You've used all ${rule.simulations} ${name} simulations this month. Buy credits to keep practising.`,
      upgrade: true,
    };
  }
  return {
    ok: false,
    reason:
      rule.simulations === 0
        ? "Upgrade to Pro or buy credits to practise in the Investor Room."
        : "You've used your free simulation. Upgrade to Pro or buy credits to practise again.",
    upgrade: true,
  };
}

/** True when the session just started (paid for by `via`) leaves no allowance and no credits. */
export function usedLastSession(usage: Usage, via: "free" | "pro" | "credit"): boolean {
  const rule = ruleFor(usage);
  const used = (paidPlanOf(usage) ? usage.proSimulationsThisMonth : usage.freeSimulationsUsed) + (via === "credit" ? 0 : 1);
  const credits = usage.credits - (via === "credit" ? 1 : 0);
  return used >= rule.simulations && credits <= 0;
}

export function assessmentAccess(usage: Usage): Access<"free" | "pro"> {
  if (usage.proActive) return { ok: true, via: "pro" };
  const allowed = ruleFor(usage).assessments;
  if (usage.assessments < allowed) return { ok: true, via: "free" };
  return {
    ok: false,
    reason: `Your free plan includes ${allowed === 1 ? "one assessment" : `${allowed} assessments`}. Upgrade to Pro for unlimited reassessments as you improve.`,
    upgrade: true,
  };
}

export function pdfAccess(usage: { proActive: boolean; tier?: Tier; rules?: PlanRules }): Access<"pro"> {
  return ruleFor(usage).pdfReports
    ? { ok: true, via: "pro" }
    : { ok: false, reason: "PDF reports aren't part of your plan. You can still read your report here.", upgrade: true };
}

export function progressAccess(usage: { proActive: boolean; tier?: Tier; rules?: PlanRules }): boolean {
  return ruleFor(usage).progressTracking;
}

/** Start of the current calendar month in Lagos (UTC+1, no daylight saving). */
export function lagosMonthStart(now = Date.now()): Date {
  const lagos = new Date(now + 60 * 60 * 1000);
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), 1) - 60 * 60 * 1000);
}

export type DeckUsage = {
  proActive: boolean;
  tier?: Tier;
  rules?: PlanRules;
  /** Decks bought one at a time and not yet used. */
  deckCredits: number;
  /** Decks Pro has unlocked this calendar month. */
  proDecksThisMonth: number;
  /** Free previews already made. */
  previewsUsed: number;
};

/** What pays for unlocking a deck in full: Pro's monthly allowance first, then a bought deck. */
export function deckUnlockAccess(usage: DeckUsage): Access<"pro" | "credit"> {
  const paid = paidPlanOf(usage);
  const rule = ruleFor(usage);
  if (paid && usage.proDecksThisMonth < rule.decksPerMonth) return { ok: true, via: "pro" };
  if (usage.deckCredits > 0) return { ok: true, via: "credit" };
  return {
    ok: false,
    reason:
      paid && rule.decksPerMonth > 0
        ? `You've used the ${rule.decksPerMonth} decks included with ${PLAN_NAMES[paid]} this month. Buy another deck to keep going.`
        : "Unlock the full deck with a plan that includes decks, or buy this one deck on its own.",
    upgrade: true,
  };
}

/** Building a new deck: unlocked straight away if paid for, otherwise the one free preview. */
export function deckBuildAccess(usage: DeckUsage): Access<"pro" | "credit" | "preview"> {
  const unlock = deckUnlockAccess(usage);
  if (unlock.ok) return unlock;
  if ((usage.rules ?? DEFAULT_PLAN_RULES).free.deckPreview && usage.previewsUsed < DECK_BUILDER.freePreviews) return { ok: true, via: "preview" };
  return unlock;
}

/** AI rewrites of single slides. Previews have none; typing changes is always free. */
export function rewriteAccess(deck: { access: DeckAccess; rewrites_used: number }, tier: Tier = "pro", rules?: PlanRules): Access<"rewrite"> {
  if (deck.access === "preview") {
    return { ok: false, reason: "Unlock the full deck to have slides rewritten. You can still edit the text yourself.", upgrade: true };
  }
  const limit = rewriteLimit(deck.access, tier, rules);
  if (deck.rewrites_used < limit) return { ok: true, via: "rewrite" };
  return {
    ok: false,
    reason: `You've used the ${limit} AI rewrites for this deck. You can still edit the text yourself.`,
    upgrade: false,
  };
}

/** AI rewrites allowed on a deck: by plan for plan-paid decks, fixed for bought ones. */
export function rewriteLimit(access: DeckAccess, tier: Tier, rules: PlanRules = DEFAULT_PLAN_RULES): number {
  if (access !== "pro") return DECK_BUILDER.creditRewritesPerDeck;
  return rules[tier === "pro_plus" ? "pro_plus" : "pro"].rewritesPerDeck;
}
