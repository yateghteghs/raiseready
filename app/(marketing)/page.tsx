import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { PricingCards } from "@/components/marketing/pricing-cards";
import { SampleReport } from "@/components/marketing/sample-report";
import { Section } from "@/components/marketing/section";
import { LogoStrip, TestimonialCards } from "@/components/marketing/showcase";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n/server";
import { publishedShowcase } from "@/lib/showcase/service";

export default async function HomePage() {
  const [{ m }, showcase] = await Promise.all([getMessages(), publishedShowcase()]);
  const t = m.home;
  const logos = showcase.filter((i) => i.kind === "logo");
  const testimonials = showcase.filter((i) => i.kind === "testimonial");
  return (
    <>
      <section className="border-b">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
          <div>
            <p className="text-primary text-sm font-medium">{t.eyebrow}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              {t.title}
            </h1>
            <p className="text-muted-foreground mt-5 text-lg">
              {t.intro}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register">
                  {t.ctaPrimary} <ArrowRightIcon aria-hidden="true" className="rtl:-scale-x-100" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/how-it-works">{t.ctaSecondary}</Link>
              </Button>
            </div>
            <p className="text-muted-foreground mt-4 text-sm">{t.freeNote}</p>
          </div>
          <SampleReport t={m.sample} />
        </div>
      </section>

      <LogoStrip items={logos} title={t.logosTitle} />

      <Section title={t.howTitle} intro={t.howIntro}>
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {m.steps.map((step, i) => (
            <li key={step.title} className="bg-card rounded-xl border p-6">
              <span className="bg-accent text-accent-foreground flex size-8 items-center justify-center rounded-full text-sm font-semibold">
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm">{step.summary}</p>
            </li>
          ))}
        </ol>
        <Link
          href="/how-it-works"
          className="text-primary mt-8 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
        >
          {t.howMore} <ArrowRightIcon className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      </Section>

      <div className="bg-muted/40 border-y">
        <Section title={t.africaTitle} intro={t.africaIntro}>
          <ul className="grid gap-6 md:grid-cols-3">
            {t.africa.map((item) => (
              <li key={item.title}>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">{item.body}</p>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {testimonials.length ? (
        <Section title={t.testimonialsTitle}>
          <TestimonialCards items={testimonials.slice(0, 3)} />
          {testimonials.length > 3 ? (
            <Link href="/testimonials" className="text-primary mt-6 inline-block text-sm font-medium underline-offset-4 hover:underline">
              {t.testimonialsMore}
            </Link>
          ) : null}
        </Section>
      ) : null}

      <Section title={t.comingSoonTitle} intro={t.comingSoonIntro}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {m.comingSoon.map((f) => (
            <li key={f.title} className="bg-card grid content-start gap-2 rounded-xl border p-5">
              <span className="bg-accent text-accent-foreground justify-self-start rounded-full px-2.5 py-0.5 text-xs font-medium">
                {t.comingSoonBadge}
              </span>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-muted-foreground text-sm">{f.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t.pricingTitle} intro={t.pricingIntro}>
        <PricingCards t={m.pricing} />
      </Section>

      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t.finalTitle}</h2>
            <p className="text-primary-foreground/80 mt-2">{t.finalBody}</p>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link href="/register">{t.ctaPrimary}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
