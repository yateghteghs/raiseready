import type { Metadata } from "next";
import Link from "next/link";

import { PricingCards } from "@/components/marketing/pricing-cards";
import { PageHero, Section } from "@/components/marketing/section";
import { FREE_PLAN, PRO_PLAN } from "@/lib/billing/plans";
import { publishedFaq } from "@/lib/faq/service";
import { getMessages } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/text";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Start free. Upgrade to Pro or buy simulation credits when you're actively raising.",
};

/** FAQ entries shown under the prices, by slug, in this order. */
const PRICING_QUESTIONS = ["free-plan", "pro-plan", "credits", "how-to-pay", "cancel-pro", "discounts-invites"];

export default async function PricingPage() {
  const { locale, m } = await getMessages();
  const t = m.pricingPage;
  const faq = await publishedFaq(locale);
  const items = faq.sections
    .flatMap((s) => s.items)
    .filter((i) => i.slug && PRICING_QUESTIONS.includes(i.slug))
    .sort((a, b) => PRICING_QUESTIONS.indexOf(a.slug!) - PRICING_QUESTIONS.indexOf(b.slug!));

  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title}>
        {t.intro}
      </PageHero>
      <Section>
        <PricingCards t={m.pricing} />
        <p className="text-muted-foreground mt-6 text-sm">
          {fill(t.note, { assessments: FREE_PLAN.assessments, simulations: FREE_PLAN.simulations, pro: PRO_PLAN.simulationsPerMonth })}
        </p>
      </Section>
      {items.length ? (
        <div className="bg-muted/40 border-t">
          <Section title={t.questions}>
            {faq.locale !== locale ? <p className="text-muted-foreground -mt-4 mb-8 text-sm">{m.faq.inEnglish}</p> : null}
            <dl className="grid gap-8 md:grid-cols-2" lang={faq.locale}>
              {items.map((item) => (
                <div key={item.id}>
                  <dt className="font-semibold">{item.question}</dt>
                  <dd className="text-muted-foreground mt-2 text-sm whitespace-pre-line">{item.answer}</dd>
                </div>
              ))}
            </dl>
            <Link href="/faq" className="text-primary mt-8 inline-block text-sm font-medium underline-offset-4 hover:underline">
              {t.allQuestions}
            </Link>
          </Section>
        </div>
      ) : null}
    </>
  );
}
