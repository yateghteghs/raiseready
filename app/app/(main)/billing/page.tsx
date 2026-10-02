import type { Metadata } from "next";
import Link from "next/link";

import { LoadProblem } from "@/components/app/load-problem";
import { BuyOptions } from "@/components/billing/buy-options";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { InviteLink } from "@/components/billing/invite-card";
import { getCurrentUser } from "@/lib/auth/session";
import { CREDIT_PACKS, DECK_BUILDER, PRO_PLUS_PLAN } from "@/lib/billing/plans";
import { planFeatures } from "@/lib/billing/plan-features";
import { PLAN_NAMES } from "@/lib/billing/plan-rules";
import { getPriceContext } from "@/lib/currency/server";
import { DICTIONARIES } from "@/lib/i18n/messages";
import { getDeckUsage } from "@/lib/decks/service";
import { availableCurrencies, inviteOfferText, minimumSpendText } from "@/lib/billing/prices";
import { getPrices } from "@/lib/billing/price-settings";
import { getReferralSettings } from "@/lib/billing/referral-settings";
import { ensureReferralCode, referralStats } from "@/lib/referrals/service";
import { SITE } from "@/lib/site";
import { getSiteUrl } from "@/lib/site-url";
import { getSubscription, getUsage, productLabel } from "@/lib/billing/service";
import { load } from "@/lib/data-errors";
import { formatMoney, koboToNaira } from "@/lib/format";
import { getMyStartup } from "@/lib/startups/service";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing" };

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });

const PAYMENT_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  success: { text: "Payment received. Thank you! Your account has been updated.", ok: true },
  pending: { text: "We're confirming your payment with Paystack. This page will update within a minute or two.", ok: true },
  failed: { text: "The payment didn't go through. You haven't been charged.", ok: false },
  cancelled: { text: "Payment cancelled. You haven't been charged.", ok: false },
  unknown: { text: "We couldn't confirm that payment. If you were charged, it will appear here shortly.", ok: false },
};

export default async function BillingPage({ searchParams }: PageProps<"/app/billing">) {
  const { payment } = await searchParams;
  const loaded = await load(async () => {
    const user = await getCurrentUser();
    if (!user) return null;
    const startup = await getMyStartup();
    const supabase = await createClient();
    const [usage, subscription, payments, code, referrals, siteUrl, programme, decks, prices] = await Promise.all([
      getUsage(user.id, startup?.id ?? null),
      getSubscription(user.id),
      supabase.from("payments").select("*").neq("status", "pending").order("created_at", { ascending: false }).limit(30),
      ensureReferralCode(user.id),
      referralStats(user.id),
      getSiteUrl(),
      getReferralSettings(),
      getDeckUsage(user.id),
      getPrices(),
    ]);
    const ctx = await getPriceContext(usage.profile.country);
    const paidBefore = (payments.data ?? []).some((p) => p.status === "success");
    return {
      usage,
      decks,
      prices,
      ctx,
      subscription,
      payments: payments.data ?? [],
      referrals,
      inviteUrl: `${siteUrl}/register?ref=${code}`,
      programme,
      referralDiscount: programme.enabled && programme.friendPercentOff > 0 && Boolean(usage.profile.referred_by) && !paidBefore,
    };
  });
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  if (!loaded.data) return <LoadProblem code="no_startup" />;
  const { usage, decks, prices: PRICES, ctx, subscription, payments, referrals, inviteUrl, referralDiscount, programme } = loaded.data;
  const inviteOffer = inviteOfferText(programme);

  const testMode = (process.env.PAYSTACK_SECRET_KEY ?? "").startsWith("sk_test_");
  const banner = typeof payment === "string" ? PAYMENT_MESSAGES[payment] : undefined;
  const ending = subscription && (subscription.status === "non_renewing" || subscription.status === "cancelled");

  return (
    <div className="grid gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1">Your plan, credits and payments. Payments are handled securely by Paystack and appear on your bank statement as {SITE.company.name}, the company behind RaiseReady.</p>
      </div>

      {banner ? (
        <p role="status" className={cn("rounded-xl border p-4 text-sm", banner.ok ? "border-primary/30 bg-accent" : "border-destructive/40 text-destructive")}>
          {banner.text}
        </p>
      ) : null}
      {testMode ? (
        <p className="border-warning bg-warning/15 rounded-xl border p-4 text-sm">
          <span className="font-medium">Test mode.</span> No real money moves. Paystack&apos;s checkout shows the test cards to use.
        </p>
      ) : null}

      <section aria-labelledby="plan-heading" className="grid gap-4 md:grid-cols-3">
        <div className="bg-card rounded-xl border p-5 md:col-span-2">
          <h2 id="plan-heading" className="text-muted-foreground text-sm">
            Your plan
          </h2>
          <p className="mt-1 text-2xl font-semibold">{PLAN_NAMES[usage.tier]}</p>
          {usage.team ? (
            <p className="text-muted-foreground text-sm">
              From your team, {usage.team.name}, until {dateFormat.format(new Date(usage.team.ends_at))}.
            </p>
          ) : null}
          {usage.proActive && !usage.team && subscription?.current_period_end ? (
            <p className="text-muted-foreground text-sm">
              {ending ? "Ends" : "Renews"} on {dateFormat.format(new Date(subscription.current_period_end))}
              {subscription.status === "attention" ? " · Your last renewal payment failed. Update your card to keep your plan." : ""}
            </p>
          ) : null}
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {usage.proActive ? (
              <div>
                <dt className="text-muted-foreground">Simulations this month</dt>
                <dd className="font-medium tabular-nums">
                  {usage.proSimulationsThisMonth} of {usage.rules[usage.tier].simulations}
                </dd>
              </div>
            ) : (
              <>
                <div>
                  <dt className="text-muted-foreground">Free assessment</dt>
                  <dd className="font-medium">{usage.assessments >= usage.rules.free.assessments ? "Used" : "Available"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Free simulation</dt>
                  <dd className="font-medium">{usage.freeSimulationsUsed >= usage.rules.free.simulations ? "Used" : "Available"}</dd>
                </div>
              </>
            )}
          </dl>
          {usage.proActive && !usage.team && subscription?.provider_subscription_code ? (
            <div className="mt-4">
              <CheckoutButton product="manage" variant="outline">
                Manage or cancel subscription
              </CheckoutButton>
            </div>
          ) : null}
        </div>
        <div className="bg-card rounded-xl border p-5">
          <h2 className="text-muted-foreground text-sm">Simulation credits</h2>
          <p className="mt-1 text-4xl font-semibold tabular-nums">{usage.credits}</p>
          <p className="text-muted-foreground text-sm">Each credit pays for one Investor Room session, with any investor and difficulty.</p>
          <p className="mt-4 text-sm">
            <Link href="/app/decks" className="font-medium underline-offset-4 hover:underline">
              Pitch decks
            </Link>
            :{" "}
            {usage.tier !== "free"
              ? `${decks.proDecksThisMonth} of ${usage.rules[usage.tier].decksPerMonth} used this month with ${PLAN_NAMES[usage.tier]}`
              : decks.previewsUsed
                ? "free preview used"
                : "free preview available"}
            {decks.deckCredits ? ` · ${decks.deckCredits} bought and ready to use` : ""}
          </p>
        </div>
      </section>

      <section aria-labelledby="buy-heading" className="grid gap-4">
        <h2 id="buy-heading" className="text-lg font-semibold">
          {usage.tier === "pro_plus" ? "Need more sessions?" : "Upgrade"}
        </h2>
        <BuyOptions
          currencies={[ctx.currency, ...availableCurrencies().filter((c) => c !== ctx.currency)]}
          referralPercent={referralDiscount ? programme.friendPercentOff : null}
          options={[
            ...(usage.tier === "free"
              ? [
                  {
                    product: "pro_monthly" as const,
                    title: "Pro",
                    perMonth: true,
                    buttonLabel: "Upgrade to Pro",
                    prices: { NGN: PRICES.NGN.pro_monthly, USD: PRICES.USD.pro_monthly },
                    features: planFeatures("pro", usage.rules, DICTIONARIES.en.pricing.features),
                  },
                ]
              : []),
            ...(usage.tier === "pro_plus"
              ? []
              : [
                  {
                    product: "pro_plus_monthly" as const,
                    title: PRO_PLUS_PLAN.name,
                    perMonth: true,
                    highlight: true,
                    buttonLabel: usage.tier === "pro" ? "Upgrade to Pro Plus" : "Get Pro Plus",
                    prices: { NGN: PRICES.NGN.pro_plus_monthly, USD: PRICES.USD.pro_plus_monthly },
                    features: planFeatures("pro_plus", usage.rules, DICTIONARIES.en.pricing.features),
                    note:
                      usage.tier === "pro"
                        ? "Pro Plus starts as soon as you pay and your Pro subscription stops renewing. Days left on Pro aren't refunded."
                        : undefined,
                  },
                ]),
            ...CREDIT_PACKS.map((pack) => ({
              product: pack.product,
              title: `${pack.simulations} simulation credits`,
              buttonLabel: `Buy ${pack.simulations} credits`,
              note: "One-off payment. No subscription.",
              prices: { NGN: PRICES.NGN[pack.product], USD: PRICES.USD[pack.product] },
            })),
            {
              product: "deck_builder" as const,
              title: "One pitch deck",
              buttonLabel: "Buy a pitch deck",
              note: `One-off payment. A full deck with PowerPoint and PDF downloads and ${DECK_BUILDER.creditRewritesPerDeck} AI rewrites. Also unlocks a free preview.`,
              prices: { NGN: PRICES.NGN.deck_builder, USD: PRICES.USD.deck_builder },
            },
          ]}
        />
      </section>

      {programme.enabled ? (
      <section aria-labelledby="invite-heading" className="bg-card grid gap-3 rounded-xl border p-5">
        <div>
          <h2 id="invite-heading" className="text-lg font-semibold">
            Invite founders
          </h2>
          <p className="text-muted-foreground text-sm">
            Share your link with other founders.{inviteOffer ? ` ${inviteOffer}` : ""}
          </p>
        </div>
        <InviteLink url={inviteUrl} />
        <p className="text-muted-foreground text-sm">
          {referrals.joined === 0
            ? "Nobody has joined with your link yet."
            : `${referrals.joined} ${referrals.joined === 1 ? "founder has" : "founders have"} joined with your link · ${referrals.creditsEarned} credits earned.`}
        </p>
        {referrals.creditsLocked > 0 ? (
          <div className="border-primary/30 bg-accent grid gap-2 rounded-lg border p-3 text-sm">
            <p>
              <span className="font-medium">
                {referrals.creditsLocked} {referrals.creditsLocked === 1 ? "credit is" : "credits are"} waiting for you.
              </span>{" "}
              They unlock automatically once you&apos;ve spent {minimumSpendText(programme)} on RaiseReady.
            </p>
            <div
              className="bg-background h-2 rounded-full"
              role="progressbar"
              aria-label="Progress towards unlocking your referral credits"
              aria-valuenow={Math.round(referrals.unlockProgress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="bg-primary h-full rounded-full" style={{ width: `${Math.round(referrals.unlockProgress * 100)}%` }} />
            </div>
            <p className="text-muted-foreground text-xs">{Math.round(referrals.unlockProgress * 100)}% of the way there</p>
          </div>
        ) : null}
      </section>
      ) : null}

      <section aria-labelledby="history-heading" className="grid gap-4">
        <h2 id="history-heading" className="text-lg font-semibold">
          Payment history
        </h2>
        {payments.length ? (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-left text-xs">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2 font-medium">Item</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 whitespace-nowrap">{dateFormat.format(new Date(p.created_at))}</td>
                    <td className="px-4 py-3">{productLabel(p.product)}</td>
                    <td className="px-4 py-3 capitalize">{p.status}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(koboToNaira(p.amount_kobo), p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No payments yet.</p>
        )}
      </section>
    </div>
  );
}
