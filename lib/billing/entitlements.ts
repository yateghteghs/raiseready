import { FREE_PLAN, PRO_PLAN } from "@/lib/billing/plans";
import type { Difficulty, Persona, Plan, SubscriptionStatus } from "@/lib/supabase/database.types";

/**
 * Plan rules (spec section 7), as pure functions so they are easy to test.
 * Every AI operation checks these on the server first; the browser's idea of
 * the plan is never trusted.
 */

/** Grace period after a subscription's period end before Pro access stops. */
export const PRO_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export type SubscriptionInfo = { status: SubscriptionStatus; current_period_end: string | null } | null;

export function isProActive(plan: Plan, subscription: SubscriptionInfo, now = Date.now()): boolean {
  if (plan !== "pro") return false;
  if (!subscription) return true; // just paid; the subscription record arrives by webhook
  const end = subscription.current_period_end ? new Date(subscription.current_period_end).getTime() : null;
  if (end !== null && now > end + PRO_GRACE_MS) return false;
  return true;
}

export type Usage = {
  proActive: boolean;
  credits: number;
  assessments: number;
  /** Simulations that used the one free allowance. */
  freeSimulationsUsed: number;
  /** Simulations covered by Pro this calendar month. */
  proSimulationsThisMonth: number;
};

export type Access<Via extends string> = { ok: true; via: Via } | { ok: false; reason: string; upgrade: boolean };

export function simulationAccess(usage: Usage, persona: Persona, difficulty: Difficulty): Access<"free" | "pro" | "credit"> {
  if (usage.proActive && usage.proSimulationsThisMonth < PRO_PLAN.simulationsPerMonth) return { ok: true, via: "pro" };

  const freeChoice = FREE_PLAN.personas.includes(persona) && FREE_PLAN.difficulties.includes(difficulty);
  if (!usage.proActive && usage.freeSimulationsUsed < FREE_PLAN.simulations && freeChoice) return { ok: true, via: "free" };
  if (usage.credits > 0) return { ok: true, via: "credit" };

  if (usage.proActive) {
    return {
      ok: false,
      reason: `You've used all ${PRO_PLAN.simulationsPerMonth} Pro simulations this month. Buy credits to keep practising.`,
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
