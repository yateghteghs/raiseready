import type { Metadata } from "next";

import { PageHero, Section } from "@/components/marketing/section";
import { PartnerGrid } from "@/components/marketing/showcase";
import { publishedShowcase } from "@/lib/showcase/service";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Partners", description: "Organisations RaiseReady works with." };

export default async function PartnersPage() {
  const partners = await publishedShowcase("partner");
  return (
    // Not translated yet: keep English text left to right in every language.
    <div lang="en" dir="ltr">
      <PageHero eyebrow="Partners" title="Who we work with">
        Accelerators, hubs and programmes that help founders get investor-ready with RaiseReady.
      </PageHero>
      <Section>
        {partners.length ? (
          <PartnerGrid items={partners} />
        ) : (
          <p className="text-muted-foreground">
            Our partner list is coming soon.
            {SITE.contactEmail ? ` Interested in partnering? Email ${SITE.contactEmail}.` : ""}
          </p>
        )}
      </Section>
    </div>
  );
}
