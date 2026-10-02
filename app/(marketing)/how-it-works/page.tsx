import type { Metadata } from "next";
import Link from "next/link";

import { PageHero, Section } from "@/components/marketing/section";
import { HOW_IT_WORKS_STEPS } from "@/components/marketing/steps";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "How it works",
  description: "Upload your deck, get scored, face an AI investor, and fix what they would challenge.",
};

const DIMENSIONS = [
  ["Problem clarity", "10%"],
  ["Solution", "10%"],
  ["Market opportunity", "10%"],
  ["Traction", "15%"],
  ["Business model", "10%"],
  ["Financial readiness", "15%"],
  ["Competition / moat", "10%"],
  ["Team", "10%"],
  ["Fundraising strategy", "5%"],
  ["Communication / defence", "5%"],
] as const;

const PERSONAS = [
  {
    name: "Seed VC",
    focus: "Market size, growth, defensibility, unit economics and how big this can get.",
  },
  {
    name: "Angel",
    focus: "You as a founder, the product, early traction and how far you can stretch each naira.",
  },
  {
    name: "Grant Evaluator",
    focus: "The problem, evidence of impact, your implementation plan and long-term sustainability.",
  },
];

export default function HowItWorksPage() {
  return (
    // Not translated yet: keep English text left to right in every language.
    <div lang="en" dir="ltr">
      <PageHero eyebrow="How it works" title="From pitch deck to pitch that holds up">
        RaiseReady gives you the questions investors will ask, before you&apos;re in the room.
      </PageHero>

      <Section>
        <ol className="grid gap-10">
          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <li key={step.title} className="grid gap-4 sm:grid-cols-[3rem_1fr]">
              <span className="bg-accent text-accent-foreground flex size-10 items-center justify-center rounded-full font-semibold">
                {i + 1}
              </span>
              <div>
                <h2 className="text-xl font-semibold">{step.title}</h2>
                <p className="text-muted-foreground mt-2 max-w-3xl">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <div className="bg-muted/40 border-y">
        <Section
          title="What we score"
          intro="Your readiness score combines ten areas, weighted the way investors weigh them. Communication and defence is added once you've done a simulation."
        >
          <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {DIMENSIONS.map(([name, weight]) => (
              <li key={name} className="bg-card flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
                <span>{name}</span>
                <span className="text-muted-foreground tabular-nums">{weight}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-6 text-sm">
            Scores fall into four bands: Not ready (0–49), Getting there (50–69), Nearly ready (70–84)
            and Investor ready (85–100).
          </p>
        </Section>
      </div>

      <Section title="Choose who you pitch to" intro="Each investor focuses on different things. Difficulty changes how hard they push, never how fair they are.">
        <ul className="grid gap-6 md:grid-cols-3">
          {PERSONAS.map((p) => (
            <li key={p.name} className="bg-card rounded-xl border p-6">
              <h3 className="font-semibold">{p.name}</h3>
              <p className="text-muted-foreground mt-2 text-sm">{p.focus}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Your documents stay yours" intro="Files are stored privately and are only used to assess your startup. Read exactly what we store and share in our privacy policy.">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/register">Test my readiness</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/privacy">Read the privacy policy</Link>
          </Button>
        </div>
      </Section>
    </div>
  );
}
