import type { Metadata } from "next";
import Link from "next/link";

import { PageHero, Section } from "@/components/marketing/section";
import { LogoStrip, TestimonialCards } from "@/components/marketing/showcase";
import { Button } from "@/components/ui/button";
import { en } from "@/lib/i18n/messages/en";
import { publishedShowcase } from "@/lib/showcase/service";

export const metadata: Metadata = { title: "Testimonials", description: "Founders on practising their pitch with RaiseReady." };

export default async function TestimonialsPage() {
  const items = await publishedShowcase();
  const testimonials = items.filter((i) => i.kind === "testimonial");
  return (
    // Not translated yet: keep English text left to right in every language.
    <div lang="en" dir="ltr">
      <PageHero eyebrow="Testimonials" title="Founders who practised first">
        What founders say about preparing for investor meetings with RaiseReady.
      </PageHero>
      <LogoStrip items={items.filter((i) => i.kind === "logo")} title={en.home.logosTitle} />
      <Section>
        {testimonials.length ? (
          <TestimonialCards items={testimonials} />
        ) : (
          <div className="grid justify-items-start gap-4">
            <p className="text-muted-foreground">Founder stories will appear here soon.</p>
            <Button asChild>
              <Link href="/register">Be one of the first</Link>
            </Button>
          </div>
        )}
      </Section>
    </div>
  );
}
