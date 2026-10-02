import { randomUUID } from "node:crypto";

import { lagosMonthStart, tierOf, type Tier, type Usage } from "@/lib/billing/entitlements";
import {
  createSubscription,
  disableSubscription,
  ensurePlan,
  initializeTransaction,
  metadataOf,
  planCodeOf,
  subscriptionManageLink,
  type PaystackTransaction,
} from "@/lib/billing/paystack";
import { CREDIT_PACKS, DECK_BUILDER, PLAN_LIMITS, PLAN_PRODUCTS, planOfProduct } from "@/lib/billing/plans";
import {
  availableCurrencies,
  codeProblem,
  discounted,
  isCurrency,
  normaliseCode,
  priceOf,
  type Currency,
} from "@/lib/billing/prices";
import { getReferralSettings } from "@/lib/billing/referral-settings";
import { hasUnlockedReferralCredits, releaseLockedRewards } from "@/lib/referrals/rewards";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, PaidPlan, PaymentProduct, SubscriptionStatus, Tables } from "@/lib/supabase/database.types";

export class BillingError extends Error {}

const PRODUCTS: Record<PaymentProduct, { credits: number; label: string }> = {
  pro_monthly: { credits: 0, label: "Pro (monthly)" },
  pro_plus_monthly: { credits: 0, label: "Pro Plus (monthly)" },
  credits_3: { credits: CREDIT_PACKS[0].simulations, label: CREDIT_PACKS[0].name },
  credits_10: { credits: CREDIT_PACKS[1].simulations, label: CREDIT_PACKS[1].name },
  deck_builder: { credits: 0, label: DECK_BUILDER.name },
};

export function productLabel(product: PaymentProduct): string {
  return PRODUCTS[product].label;
}

async function audit(action: string, targetId: string | null, metadata: Record<string, unknown>) {
  await createAdminClient()
    .from("audit_logs")
    .insert({ actor_id: null, action, target_type: "profile", target_id: targetId, metadata: metadata as Json });
}

export async function getSubscription(userId: string): Promise<Tables<"subscriptions"> | null> {
  const { data } = await createAdminClient()
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Everything the plan rules need, read fresh from the database (never from the browser). */
/** The founder's team, if they belong to one (active or not). */
export async function getMembership(userId: string): Promise<Pick<Tables<"teams">, "id" | "name" | "ends_at" | "owner_id"> | null> {
  const admin = createAdminClient();
  const { data: member } = await admin.from("team_members").select("team_id").eq("user_id", userId).maybeSingle();
  if (!member) return null;
  const { data: team } = await admin.from("teams").select("id, name, ends_at, owner_id").eq("id", member.team_id).maybeSingle();
  return team ?? null;
}

export type FullUsage = Usage & {
  tier: Tier;
  profile: Tables<"profiles">;
  /** The team giving this founder Pro Plus, while it's active. */
  team: Pick<Tables<"teams">, "id" | "name" | "ends_at"> | null;
};

export async function getUsage(userId: string, startupId: string | null): Promise<FullUsage> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin.from("profiles").select("*").eq("id", userId).single();
  if (error || !profile) throw new Error(`Could not load profile: ${error?.message}`);
  const [subscription, membership] = await Promise.all([getSubscription(userId), getMembership(userId)]);
  const team = membership && new Date(membership.ends_at).getTime() > Date.now() ? membership : null;
  const tier = tierOf(profile.plan, subscription, team);

  let assessments = 0;
  let freeSimulationsUsed = 0;
  let proSimulationsThisMonth = 0;
  if (startupId) {
    const [a, free, pro] = await Promise.all([
      admin.from("assessments").select("id", { count: "exact", head: true }).eq("startup_id", startupId),
      admin.from("simulations").select("id", { count: "exact", head: true }).eq("startup_id", startupId).eq("funded_by", "free"),
      admin
        .from("simulations")
        .select("id", { count: "exact", head: true })
        .eq("startup_id", startupId)
        .eq("funded_by", "pro")
        .gte("created_at", lagosMonthStart().toISOString()),
    ]);
    assessments = a.count ?? 0;
    freeSimulationsUsed = free.count ?? 0;
    proSimulationsThisMonth = pro.count ?? 0;
  }
  return {
    profile,
    tier,
    team,
    proActive: tier !== "free",
    credits: profile.credits,
    assessments,
    freeSimulationsUsed,
    proSimulationsThisMonth,
  };
}

/** Spends one credit atomically. Returns false if none was left. */
export async function consumeCredit(userId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("consume_credit", { p_user_id: userId });
  if (error) throw new Error(`Could not use credit: ${error.message}`);
  return data !== null && data !== undefined;
}

export async function refundCredit(userId: string): Promise<void> {
  await createAdminClient().rpc("add_credits", { p_user_id: userId, p_amount: 1 });
}

export type PriceQuote = {
  product: PaymentProduct;
  currency: Currency;
  list: number;
  amount: number;
  discount: number;
  percentOff: number;
  /** Where the discount came from, for the founder and the payment record. */
  source: { kind: "code"; codeId: string; code: string } | { kind: "referral" } | null;
};

/** Whether a founder has ever paid successfully (referral discounts are for first purchases). */
async function hasPaid(userId: string): Promise<boolean> {
  const { count } = await createAdminClient()
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "success");
  return (count ?? 0) > 0;
}

/**
 * What a founder will pay: the list price, less the better of a discount code
 * they typed and their referral discount (first purchase only).
 * Throws BillingError with a message to show when a typed code can't be used.
 */
export async function quote(userId: string, product: PaymentProduct, currency: Currency, typedCode?: string | null): Promise<PriceQuote> {
  if (!availableCurrencies().includes(currency)) throw new BillingError("Payments in that currency aren't available yet.");
  const list = priceOf(product, currency);
  const admin = createAdminClient();

  let best: { percent: number; source: PriceQuote["source"] } = { percent: 0, source: null };

  const code = typedCode ? normaliseCode(typedCode) : "";
  if (code) {
    const { data: row } = await admin.from("discount_codes").select("*").eq("code", code).maybeSingle();
    const [{ count: redemptions }, { count: mine }] = row
      ? await Promise.all([
          admin.from("discount_redemptions").select("id", { count: "exact", head: true }).eq("code_id", row.id),
          admin.from("discount_redemptions").select("id", { count: "exact", head: true }).eq("code_id", row.id).eq("user_id", userId),
        ])
      : [{ count: 0 }, { count: 0 }];
    const problem = codeProblem(row, { product, redemptions: redemptions ?? 0, usedByThisFounder: (mine ?? 0) > 0 });
    if (problem) throw new BillingError(problem);
    best = { percent: row!.percent_off, source: { kind: "code", codeId: row!.id, code } };
  }

  const { data: profile } = await admin.from("profiles").select("referred_by").eq("id", userId).maybeSingle();
  if (profile?.referred_by) {
    const referral = await getReferralSettings();
    if (referral.enabled && referral.friendPercentOff > best.percent && !(await hasPaid(userId))) {
      best = { percent: referral.friendPercentOff, source: { kind: "referral" } };
    }
  }

  const { amount, discount } = discounted(list, best.percent, currency);
  return { product, currency, list, amount, discount, percentOff: best.percent, source: discount > 0 ? best.source : null };
}

/**
 * Starts a Paystack checkout: records a pending payment, then initialises the
 * transaction on the server and returns where to send the founder.
 *
 * Pro at full price uses the Paystack plan, so Paystack renews it monthly.
 * Pro with a discount is a one-off charge for the first month; once it
 * succeeds we start the plan from next month on the same card (see
 * applyChargeSuccess). A 100% discount skips Paystack entirely.
 */
export async function startCheckout(
  user: { id: string; email: string | null },
  product: PaymentProduct,
  callbackUrl: string,
  options: { currency?: string; code?: string | null } = {},
): Promise<string> {
  if (!user.email) throw new BillingError("Your account has no email address. Contact support.");
  const currency = isCurrency(options.currency) ? options.currency : "NGN";
  const plan = planOfProduct(product);
  if (plan) {
    const usage = await getUsage(user.id, null);
    if (usage.team) throw new BillingError(`Your team, ${usage.team.name}, already gives you Pro Plus.`);
    if (usage.tier === plan) throw new BillingError(`You're already on ${PLAN_LIMITS[plan].name}.`);
    if (usage.tier === "pro_plus" && plan === "pro") {
      throw new BillingError("To move to Pro, cancel Pro Plus first. You keep Pro Plus until the end of the month you've paid for.");
    }
  }

  const q = await quote(user.id, product, currency, options.code);
  const reference = `rr_${product}_${randomUUID().replace(/-/g, "")}`;
  const admin = createAdminClient();
  const { error } = await admin.from("payments").insert({
    user_id: user.id,
    provider: "paystack",
    reference,
    amount_kobo: q.amount,
    list_amount_kobo: q.list,
    currency,
    product,
    status: "pending",
    discount_code_id: q.source?.kind === "code" ? q.source.codeId : null,
    referral_discount: q.source?.kind === "referral",
  });
  if (error) throw new Error(`Could not record payment: ${error.message}`);

  if (q.amount === 0) {
    // Free with a 100% code: nothing to charge, so grant it now.
    await applyChargeSuccess(
      { id: 0, status: "success", reference, amount: 0, currency, paid_at: new Date().toISOString() },
      { event: "free_with_code", reference },
    );
    return "/app/billing?payment=success";
  }

  const planCode = plan && q.discount === 0 ? await ensurePlan(PLAN_PRODUCTS[plan] as "pro_monthly" | "pro_plus_monthly", currency) : undefined;
  const tx = await initializeTransaction({
    email: user.email,
    amountKobo: q.amount,
    currency,
    reference,
    callbackUrl,
    metadata: { user_id: user.id, product },
    planCode,
  });
  return tx.authorization_url;
}

function plusOneMonth(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

/**
 * Applies a successful charge exactly once. Called from the webhook (the
 * source of truth) and from the post-payment return page; whichever arrives
 * first grants the purchase, the other finds nothing left to do.
 * Returns true if this call granted something.
 */
export async function applyChargeSuccess(tx: PaystackTransaction, raw: unknown): Promise<boolean> {
  if (tx.status !== "success") return false;
  const admin = createAdminClient();
  const { data: payment } = await admin.from("payments").select("*").eq("reference", tx.reference).maybeSingle();

  if (!payment) return applyRenewal(tx, raw);

  if (tx.amount !== payment.amount_kobo || tx.currency !== payment.currency) {
    await admin.from("payments").update({ status: "failed", raw_event: raw as Json }).eq("id", payment.id).eq("status", "pending");
    await audit("billing.amount_mismatch", payment.user_id, { reference: tx.reference, amount: tx.amount, currency: tx.currency });
    return false;
  }

  // Only the call that flips pending -> success grants the purchase.
  const { data: flipped } = await admin
    .from("payments")
    .update({ status: "success", raw_event: raw as Json })
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("id");
  if (!flipped || flipped.length === 0) return false;

  const customerCode = tx.customer?.customer_code ?? null;
  if (customerCode) {
    await admin.from("profiles").update({ paystack_customer_code: customerCode }).eq("id", payment.user_id).is("paystack_customer_code", null);
  }

  if (payment.discount_code_id) {
    await admin
      .from("discount_redemptions")
      .insert({ code_id: payment.discount_code_id, user_id: payment.user_id, payment_reference: tx.reference });
  }

  const plan = planOfProduct(payment.product);
  if (plan) {
    const existing = await getSubscription(payment.user_id);
    const periodEnd = plusOneMonth(tx.paid_at);
    // A discounted first month was a one-off charge: start the plan from next month.
    const renews =
      planCodeOf(tx.plan) !== null || (await startRenewalAfterDiscount(tx, payment.currency, periodEnd, payment.user_id, plan));
    const status = renews ? "active" : "non_renewing";
    const ended = existing && (existing.status === "cancelled" || existing.status === "completed");
    if (existing && !ended && existing.plan !== plan) {
      // An upgrade from Pro: end the Pro subscription so it isn't charged
      // again, and start a separate record for Pro Plus.
      await endSubscription(existing, payment.user_id);
      await admin.from("subscriptions").insert({ user_id: payment.user_id, plan, status, current_period_end: periodEnd });
    } else if (existing && !ended) {
      await admin.from("subscriptions").update({ status, current_period_end: periodEnd }).eq("id", existing.id);
    } else {
      // First subscription, or a new one after the last ended: a fresh record.
      await admin.from("subscriptions").insert({ user_id: payment.user_id, plan, status, current_period_end: periodEnd });
    }
    await admin.from("profiles").update({ plan }).eq("id", payment.user_id);
    await audit(plan === "pro" ? "billing.pro_started" : "billing.pro_plus_started", payment.user_id, {
      reference: tx.reference,
      renews,
      upgraded_from: existing && existing.plan !== plan ? existing.plan : undefined,
    });
  } else if (payment.product === "deck_builder") {
    const { error } = await admin.rpc("add_deck_credits", { p_user_id: payment.user_id, p_amount: 1 });
    if (error) throw new Error(`Could not add the deck: ${error.message}`);
    await audit("billing.deck_added", payment.user_id, { reference: tx.reference });
  } else {
    const credits = PRODUCTS[payment.product].credits;
    const { error } = await admin.rpc("add_credits", { p_user_id: payment.user_id, p_amount: credits });
    if (error) throw new Error(`Could not add credits: ${error.message}`);
    await audit("billing.credits_added", payment.user_id, { reference: tx.reference, credits });
  }

  if (payment.amount_kobo > 0) {
    await rewardReferrer(payment.user_id, tx.reference);
    // This founder may be an inviter whose locked credits this payment unlocks.
    await releaseLockedRewards(payment.user_id);
  }
  return true;
}

/**
 * After a discounted first month of Pro, subscribes the founder to the plan
 * starting when that month ends, on the card they just used. Returns false
 * (and logs why) if it can't, in which case Pro simply ends after the month.
 */
async function startRenewalAfterDiscount(
  tx: PaystackTransaction,
  currency: string,
  startDate: string,
  userId: string,
  plan: PaidPlan,
): Promise<boolean> {
  const customerCode = tx.customer?.customer_code;
  const authorizationCode = tx.authorization?.reusable ? tx.authorization.authorization_code : undefined;
  if (!customerCode || !authorizationCode || !isCurrency(currency)) {
    await audit("billing.renewal_not_started", userId, { reference: tx.reference, reason: "no reusable card" });
    return false;
  }
  try {
    const planCode = await ensurePlan(PLAN_PRODUCTS[plan] as "pro_monthly" | "pro_plus_monthly", currency);
    await createSubscription({ customerCode, planCode, authorizationCode, startDate });
    return true;
  } catch (error) {
    console.error("[billing] could not start renewal after discount:", error);
    await audit("billing.renewal_not_started", userId, { reference: tx.reference, reason: "paystack error" });
    return false;
  }
}

/**
 * Stops an old subscription after an upgrade. Its record is marked cancelled
 * straight away; Paystack's own "disabled" event later finds nothing to do.
 * If Paystack can't be reached, staff are alerted through the audit log.
 */
async function endSubscription(sub: Tables<"subscriptions">, userId: string): Promise<void> {
  await createAdminClient().from("subscriptions").update({ status: "cancelled" }).eq("id", sub.id);
  if (!sub.provider_subscription_code) return;
  try {
    await disableSubscription(sub.provider_subscription_code);
  } catch (error) {
    console.error("[billing] could not cancel the old subscription after an upgrade:", error);
    await audit("billing.old_subscription_not_cancelled", userId, { subscription_code: sub.provider_subscription_code });
  }
}

/** Gives the founder who invited this one their credits, once, on this founder's first payment. */
async function rewardReferrer(userId: string, reference: string): Promise<void> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("referred_by").eq("id", userId).maybeSingle();
  const referrerId = profile?.referred_by;
  if (!referrerId) return;
  const { data: referrer } = await admin.from("profiles").select("status").eq("id", referrerId).maybeSingle();
  if (!referrer || referrer.status !== "active") return;
  const { enabled, referrerCredits: credits } = await getReferralSettings();
  if (!enabled || credits <= 0) return;
  const { data: earlier } = await admin.from("referral_rewards").select("id").eq("referred_id", userId).maybeSingle();
  if (earlier) return;
  // Credits are usable only once the inviter has spent the minimum themselves;
  // until then they wait as "locked" and releaseLockedRewards hands them over.
  const unlocked = await hasUnlockedReferralCredits(referrerId);
  // The unique index on referred_id also stops two simultaneous rewards.
  const { error } = await admin.from("referral_rewards").insert({
    referrer_id: referrerId,
    referred_id: userId,
    credits,
    payment_reference: reference,
    status: unlocked ? "released" : "locked",
    released_at: unlocked ? new Date().toISOString() : null,
  });
  if (error) return;
  if (unlocked) await admin.rpc("add_credits", { p_user_id: referrerId, p_amount: credits });
  await audit("billing.referral_rewarded", referrerId, { referred_id: userId, credits, locked: !unlocked });
}

/** A Pro renewal charge: Paystack creates the reference, so we record it now. */
async function applyRenewal(tx: PaystackTransaction, raw: unknown): Promise<boolean> {
  const planCode = planCodeOf(tx.plan);
  const customerCode = tx.customer?.customer_code;
  if (!planCode || !customerCode) return false;

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("paystack_customer_code", customerCode).maybeSingle();
  if (!profile) return false;

  // Which plan renewed: the founder's current subscription, or the price paid.
  const existing = await getSubscription(profile.id);
  const plan: PaidPlan =
    existing?.plan ?? (isCurrency(tx.currency) && tx.amount === priceOf("pro_plus_monthly", tx.currency) ? "pro_plus" : "pro");

  const { error } = await admin.from("payments").insert({
    user_id: profile.id,
    provider: "paystack",
    reference: tx.reference,
    amount_kobo: tx.amount,
    currency: tx.currency,
    product: PLAN_PRODUCTS[plan],
    status: "success",
    raw_event: raw as Json,
  });
  if (error) return false; // already recorded (unique reference)

  await admin.from("profiles").update({ plan }).eq("id", profile.id);
  if (existing) {
    await admin.from("subscriptions").update({ status: "active", current_period_end: plusOneMonth(tx.paid_at) }).eq("id", existing.id);
  }
  await audit(plan === "pro" ? "billing.pro_renewed" : "billing.pro_plus_renewed", profile.id, { reference: tx.reference });
  await releaseLockedRewards(profile.id);
  return true;
}

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "active",
  "non-renewing": "non_renewing",
  attention: "attention",
  cancelled: "cancelled",
  complete: "completed",
  completed: "completed",
};

type SubscriptionPayload = {
  subscription_code?: string;
  status?: string;
  next_payment_date?: string | null;
  customer?: { customer_code?: string };
};

/** Keeps the subscription record in step with Paystack's subscription and invoice events. */
export async function applySubscriptionEvent(event: string, data: Record<string, unknown>): Promise<void> {
  const sub = (event.startsWith("invoice.") ? (data.subscription as SubscriptionPayload) : (data as SubscriptionPayload)) ?? {};
  const customerCode = (data.customer as { customer_code?: string } | undefined)?.customer_code ?? sub.customer?.customer_code;
  const code = sub.subscription_code;
  if (!code || !customerCode) return;

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("paystack_customer_code", customerCode).maybeSingle();
  if (!profile) return;

  let status = STATUS_MAP[sub.status ?? ""] ?? "active";
  if (event === "invoice.payment_failed") status = "attention";
  if (event === "subscription.disable") status = sub.status === "complete" || sub.status === "completed" ? "completed" : "cancelled";
  if (event === "subscription.not_renew") status = "non_renewing";

  const fields = {
    provider_subscription_code: code,
    status,
    ...(sub.next_payment_date ? { current_period_end: sub.next_payment_date } : {}),
  };

  const { data: byCode } = await admin.from("subscriptions").select("id, status").eq("provider_subscription_code", code).maybeSingle();
  // A subscription we already ended (after an upgrade) stays ended.
  if (byCode && byCode.status === "cancelled" && status !== "cancelled" && status !== "completed") return;
  if (byCode) {
    await admin.from("subscriptions").update(fields).eq("id", byCode.id);
  } else {
    const { data: pending } = await admin
      .from("subscriptions")
      .select("id")
      .eq("user_id", profile.id)
      .is("provider_subscription_code", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pending) await admin.from("subscriptions").update(fields).eq("id", pending.id);
    else {
      const { data: owner } = await admin.from("profiles").select("plan").eq("id", profile.id).maybeSingle();
      await admin.from("subscriptions").insert({ user_id: profile.id, plan: owner?.plan === "pro_plus" ? "pro_plus" : "pro", ...fields });
    }
  }

  if (status === "cancelled" || status === "completed") {
    // Only the founder's current subscription ending ends their plan; an old
    // one ending after an upgrade doesn't.
    const current = await getSubscription(profile.id);
    if (!current || current.provider_subscription_code === code || current.status === "cancelled" || current.status === "completed") {
      await admin.from("profiles").update({ plan: "free" }).eq("id", profile.id);
      await audit("billing.pro_ended", profile.id, { event, subscription_code: code });
    }
  }
}

/** Routes a verified webhook event. Unknown events are ignored. */
export async function handlePaystackEvent(payload: { event?: string; data?: Record<string, unknown> }): Promise<void> {
  const event = payload.event ?? "";
  const data = payload.data ?? {};
  if (event === "charge.success") {
    await applyChargeSuccess(data as unknown as PaystackTransaction, payload);
  } else if (
    event === "subscription.create" ||
    event === "subscription.not_renew" ||
    event === "subscription.disable" ||
    event === "invoice.update" ||
    event === "invoice.payment_failed"
  ) {
    await applySubscriptionEvent(event, data);
  }
}

/** Link to Paystack's page for cancelling or updating the card on a subscription. */
export async function manageSubscriptionLink(userId: string): Promise<string> {
  const sub = await getSubscription(userId);
  if (!sub?.provider_subscription_code) {
    throw new BillingError("Your subscription is still being set up. Try again in a few minutes.");
  }
  return subscriptionManageLink(sub.provider_subscription_code);
}

/** Who a verified transaction belongs to, from the metadata we set at checkout. */
export function transactionUserId(tx: PaystackTransaction): string | null {
  const id = metadataOf(tx).user_id;
  return typeof id === "string" ? id : null;
}
