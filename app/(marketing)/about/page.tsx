import type { Metadata } from "next";
import Link from "next/link";

import { PageHero, Section } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About",
  description: "Why we built RaiseReady for African founders.",
};

const PRINCIPLES = [
  {
    title: "Honest over flattering",
    body: "A practice investor that only says nice things is useless. We'd rather you hear the hard question from us first.",
  },
  {
    title: "Consistent and explainable",
    body: "Your score is calculated by fixed rules from clear indicators, so you can see exactly why it moved.",
  },
  {
    title: "Your data, your call",
    body: "Your documents are stored privately, used only to help you, and can be deleted.",
  },
];

export default function AboutPage() {
  return (
    // Not translated yet: keep English text left to right in every language.
    <div lang="en" dir="ltr">
      <PageHero eyebrow="About" title="Every founder deserves a practice round">
        Most founders get very few chances in front of investors. A meeting that goes badly because
        of an unprepared answer is a chance you rarely get back.
      </PageHero>
      <Section>
        <div className="text-muted-foreground grid max-w-3xl gap-5 text-lg">
          <p>
            Founders with networks get mock pitches, warm feedback and an early read on what investors
            will question. Many African founders don&apos;t. They meet investors for the first time with
            the deck as their only preparation.
          </p>
          <p>
            RaiseReady closes that gap. It reads your documents the way an analyst would, scores your
            readiness against what investors actually look for, and puts you in a room with an AI
            investor who asks the follow-up question, notices the number that doesn&apos;t add up, and
            tells you what to fix.
          </p>
          <p>
            RaiseReady is built for founders across Africa, from Lagos and Accra to Nairobi, Kigali, Cairo and
            Cape Town, and for the angels, VCs and grant panels they pitch to.
          </p>
        </div>
      </Section>
      <div className="bg-muted/40 border-y">
        <Section title="What we believe">
          <ul className="grid gap-6 md:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <li key={p.title}>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">{p.body}</p>
              </li>
            ))}
          </ul>
        </Section>
      </div>
      <Section>
        <div className="flex flex-col items-start gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">Ready for your practice round?</h2>
          <Button asChild size="lg">
            <Link href="/register">Test my readiness</Link>
          </Button>
        </div>
      </Section>
    </div>
  );
}
