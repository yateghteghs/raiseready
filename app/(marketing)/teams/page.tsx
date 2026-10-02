import type { Metadata } from "next";
import { CheckIcon } from "lucide-react";

import { PageHero, Section } from "@/components/marketing/section";
import { TeamEnquiryForm } from "@/components/teams/enquiry-form";
import { getPlanRules } from "@/lib/billing/plan-settings";

export const metadata: Metadata = {
  title: "Teams",
  description: "RaiseReady for accelerators, incubators, hubs and fellowship programmes: Pro Plus for every founder in your cohort.",
};


export default async function TeamsPage() {
  const rules = await getPlanRules();
  const BENEFITS = [
  `Pro Plus for every founder: ${rules.pro_plus.simulations} Investor Room sessions and ${rules.pro_plus.decksPerMonth} pitch decks a month each`,
  "Founders join with one link; no cards or individual payments",
  "A cohort view: each founder's readiness score, practice meetings and last activity",
  "Founders' documents, answers and reports stay private to them",
  "One agreement and one invoice for the whole programme, in naira or dollars",
  "New Pro Plus features, like voice practice, included as they launch",
];
  return (
    // Not translated yet: keep English text left to right in every language.
    <div lang="en" dir="ltr">
      <PageHero eyebrow="Teams" title="Get your whole cohort investor-ready">
        For accelerators, incubators, hubs and fellowship programmes. Give every founder a tough AI investor to practise with before demo
        day, and see who needs help.
      </PageHero>
      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="grid content-start gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">What your programme gets</h2>
            <ul className="grid gap-3">
              {BENEFITS.map((b) => (
                <li key={b} className="flex gap-2">
                  <CheckIcon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  {b}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-sm">
              Pricing depends on the size and length of your programme. Tell us about it and we&apos;ll send a proposal.
            </p>
          </div>
          <div className="grid content-start gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">Talk to us</h2>
            <TeamEnquiryForm />
          </div>
        </div>
      </Section>
    </div>
  );
}
