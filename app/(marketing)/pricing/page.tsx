import type { Metadata } from "next";

import { PricingCards } from "@/components/marketing/pricing-cards";
import { PageHero, Section } from "@/components/marketing/section";
import { FREE_PLAN, PRO_PLAN } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Start free. Upgrade to Pro or buy simulation credits when you're actively raising.",
};

const FAQ = [
  {
    q: "What counts as a simulation?",
    a: "One full Investor Room session with one investor, from the first question to your results.",
  },
  {
    q: "Do credits expire?",
    a: "Credits are for pay-as-you-go use without a subscription. We'll show any expiry terms clearly before you buy.",
  },
  {
    q: "How do I pay?",
    a: "Payments are in naira and handled by Paystack. RaiseReady never sees or stores your card details.",
  },
  {
    q: "Can I cancel Pro?",
    a: "Yes. You keep Pro until the end of the month you've paid for, then return to the Free plan.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero eyebrow="Pricing" title="Practise as much as you need">
        Start with a free assessment and simulation. Upgrade when you&apos;re preparing for real meetings.
      </PageHero>
      <Section>
        <PricingCards />
        <p className="text-muted-foreground mt-6 text-sm">
          Free includes {FREE_PLAN.assessments} assessment and {FREE_PLAN.simulations} simulation in total.
          Pro includes up to {PRO_PLAN.simulationsPerMonth} simulations each month. Prices are in Nigerian
          naira.
        </p>
      </Section>
      <div className="bg-muted/40 border-t">
        <Section title="Questions">
          <dl className="grid gap-8 md:grid-cols-2">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="font-semibold">{item.q}</dt>
                <dd className="text-muted-foreground mt-2 text-sm">{item.a}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </>
  );
}
