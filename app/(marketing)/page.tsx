import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { PricingCards } from "@/components/marketing/pricing-cards";
import { SampleReport } from "@/components/marketing/sample-report";
import { Section } from "@/components/marketing/section";
import { LogoStrip, TestimonialCards } from "@/components/marketing/showcase";
import { HOW_IT_WORKS_STEPS } from "@/components/marketing/steps";
import { Button } from "@/components/ui/button";
import { publishedShowcase } from "@/lib/showcase/service";

// Logos and testimonials are edited in the admin area, which also refreshes
// this page straight away; the timer is a fallback.
export const revalidate = 3600;

export default async function HomePage() {
  const showcase = await publishedShowcase();
  const logos = showcase.filter((i) => i.kind === "logo");
  const testimonials = showcase.filter((i) => i.kind === "testimonial");
  return (
    <>
      <section className="border-b">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
          <div>
            <p className="text-primary text-sm font-medium">For African startup founders</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Don&apos;t practice on investors. Practice on AI first.
            </h1>
            <p className="text-muted-foreground mt-5 text-lg">
              Upload your pitch deck, get a structured readiness assessment, then face an AI investor
              who questions you, follows up on weak answers and flags contradictions with your own
              documents.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register">
                  Test my readiness <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="text-muted-foreground mt-4 text-sm">Free to start. No card needed.</p>
          </div>
          <SampleReport />
        </div>
      </section>

      <LogoStrip items={logos} />

      <Section
        title="How it works"
        intro="Four steps from first upload to a pitch that holds up under questioning."
      >
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS_STEPS.map((step, i) => (
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
          More on how it works <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      </Section>

      <div className="bg-muted/40 border-y">
        <Section
          title="Built for raising in Africa"
          intro="Investors here ask about things generic pitch tools ignore. RaiseReady is built to ask them too."
        >
          <ul className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Naira first",
                body: "Amounts are shown in ₦ by default, and every figure keeps its own currency, so dollar raises and naira revenue are never mixed up.",
              },
              {
                title: "Local market questions",
                body: "Expect questions about FX exposure, regulation and informal competition, not just a Silicon Valley checklist.",
              },
              {
                title: "Three kinds of investor",
                body: "Practise with a Seed VC, an Angel or a Grant Evaluator, because a grant panel wants different answers from a VC.",
              },
            ].map((item) => (
              <li key={item.title}>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">{item.body}</p>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {testimonials.length ? (
        <Section title="What founders say">
          <TestimonialCards items={testimonials.slice(0, 3)} />
          {testimonials.length > 3 ? (
            <Link href="/testimonials" className="text-primary mt-6 inline-block text-sm font-medium underline-offset-4 hover:underline">
              Read more stories
            </Link>
          ) : null}
        </Section>
      ) : null}

      <Section title="Simple pricing" intro="Start free. Upgrade when you're actively raising.">
        <PricingCards />
      </Section>

      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Find your weak spots before investors do.</h2>
            <p className="text-primary-foreground/80 mt-2">All you need is your pitch deck as a PDF.</p>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link href="/register">Test my readiness</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
