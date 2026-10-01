import type { Metadata } from "next";

import { PageHero, Section } from "@/components/marketing/section";
import { PartnerGrid } from "@/components/marketing/showcase";
import { publishedShowcase } from "@/lib/showcase/service";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Partners", description: "Organisations RaiseReady works with." };
export const revalidate = 3600;

export default async function PartnersPage() {
  const partners = await publishedShowcase("partner");
  return (
    <>
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
    </>
  );
}
