import { DECK_BUILDER, FREE_PLAN, PLAN_LIMITS } from "@/lib/billing/plans";
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
  credits: number;
  assessments: number;
  /** Simulations that used the one free allowance. */
  freeSimulationsUsed: number;
  /** Simulations covered by Pro or Pro Plus this calendar month. */
  proSimulationsThisMonth: number;
};

export type Access<Via extends string> = { ok: true; via: Via } | { ok: false; reason: string; upgrade: boolean };

export function simulationAccess(usage: Usage, persona: Persona, difficulty: Difficulty): Access<"free" | "pro" | "credit"> {
  const paid = paidPlanOf(usage);
  const limit = paid ? PLAN_LIMITS[paid] : null;
  if (limit && usage.proSimulationsThisMonth < limit.simulationsPerMonth) return { ok: true, via: "pro" };

  const freeChoice = FREE_PLAN.personas.includes(persona) && FREE_PLAN.difficulties.includes(difficulty);
  if (!limit && usage.freeSimulationsUsed < FREE_PLAN.simulations && freeChoice) return { ok: true, via: "free" };
  if (usage.credits > 0) return { ok: true, via: "credit" };

  if (limit) {
    return {
      ok: false,
      reason: `You've used all ${limit.simulationsPerMonth} ${limit.name} simulations this month. Buy credits to keep practising.`,
      upgrade: true,
    };
  }
  if (!freeChoice && usage.freeSimulationsUsed < FREE_PLAN.simulations) {
    return {
      ok: false,
      reason: "The Grant Evaluator and the Tough difficulty are included with Pro or credits. Your free simulation can use an Angel or Seed VC on Friendly or Analytical.",
      upgrade: true,
    };
  }
  return { ok: false, reason: "You've used your free simulation. Upgrade to Pro or buy credits to practise again.", upgrade: true };
}

export function assessmentAccess(usage: Usage): Access<"free" | "pro"> {
  if (usage.proActive) return { ok: true, via: "pro" };
  if (usage.assessments < FREE_PLAN.assessments) return { ok: true, via: "free" };
  return {
    ok: false,
    reason: "Your free plan includes one assessment. Upgrade to Pro for unlimited reassessments as you improve.",
    upgrade: true,
  };
}

export function pdfAccess(usage: Pick<Usage, "proActive">): Access<"pro"> {
  return usage.proActive
    ? { ok: true, via: "pro" }
    : { ok: false, reason: "PDF reports are part of Pro. You can still read your report here.", upgrade: true };
}

/** Start of the current calendar month in Lagos (UTC+1, no daylight saving). */
export function lagosMonthStart(now = Date.now()): Date {
  const lagos = new Date(now + 60 * 60 * 1000);
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), 1) - 60 * 60 * 1000);
}

export type DeckUsage = {
  proActive: boolean;
  tier?: Tier;
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
  const limit = paid ? PLAN_LIMITS[paid] : null;
  if (limit && usage.proDecksThisMonth < limit.decksPerMonth) return { ok: true, via: "pro" };
  if (usage.deckCredits > 0) return { ok: true, via: "credit" };
  return {
    ok: false,
    reason: limit
      ? `You've used the ${limit.decksPerMonth} decks included with ${limit.name} this month. Buy another deck to keep going.`
      : "Unlock the full deck with Pro, or buy this one deck on its own.",
    upgrade: true,
  };
}

/** Building a new deck: unlocked straight away if paid for, otherwise the one free preview. */
export function deckBuildAccess(usage: DeckUsage): Access<"pro" | "credit" | "preview"> {
  const unlock = deckUnlockAccess(usage);
  if (unlock.ok) return unlock;
  if (usage.previewsUsed < DECK_BUILDER.freePreviews) return { ok: true, via: "preview" };
  return unlock;
}

/** AI rewrites of single slides. Previews have none; typing changes is always free. */
export function rewriteAccess(deck: { access: DeckAccess; rewrites_used: number }, tier: Tier = "pro"): Access<"rewrite"> {
  if (deck.access === "preview") {
    return { ok: false, reason: "Unlock the full deck to have slides rewritten. You can still edit the text yourself.", upgrade: true };
  }
  const limit = rewriteLimit(deck.access, tier);
  if (deck.rewrites_used < limit) return { ok: true, via: "rewrite" };
  return {
    ok: false,
    reason: `You've used the ${limit} AI rewrites for this deck. You can still edit the text yourself.`,
    upgrade: false,
  };
}

/** AI rewrites allowed on a deck: by plan for plan-paid decks, fixed for bought ones. */
export function rewriteLimit(access: DeckAccess, tier: Tier): number {
  if (access !== "pro") return DECK_BUILDER.creditRewritesPerDeck;
  return PLAN_LIMITS[tier === "pro_plus" ? "pro_plus" : "pro"].rewritesPerDeck;
}
