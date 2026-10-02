import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";

import { PageHero, Section } from "@/components/marketing/section";
import { publishedFaq } from "@/lib/faq/service";
import { getMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getMessages();
  return { title: m.faq.title, description: m.faq.intro };
}

export default async function FaqPage() {
  const { locale, m } = await getMessages();
  const t = m.faq;
  const faq = await publishedFaq(locale);
  const fellBack = faq.locale !== locale;
  // FAQPage structured data, so search engines can show the answers. "<" is
  // escaped so an answer can never close the script tag.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.sections.flatMap((s) =>
      s.items.map((i) => ({ "@type": "Question", name: i.question, acceptedAnswer: { "@type": "Answer", text: i.answer } })),
    ),
  }).replace(/</g, "\\u003c");

  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title}>
        {t.intro}
      </PageHero>
      <Section>
        {fellBack ? <p className="bg-muted/60 mb-8 rounded-lg px-4 py-3 text-sm">{t.inEnglish}</p> : null}
        {faq.sections.length ? (
          <div className="grid max-w-3xl gap-12" lang={faq.locale} dir={fellBack ? "ltr" : undefined}>
            {faq.sections.map((section) => (
              <section key={section.category} aria-labelledby={`faq-${section.items[0].id}`}>
                <h2 id={`faq-${section.items[0].id}`} className="text-xl font-semibold tracking-tight">
                  {section.category}
                </h2>
                <div className="mt-4 divide-y rounded-xl border">
                  {section.items.map((item) => (
                    <details key={item.id} id={item.slug ?? undefined} className="group">
                      <summary className="hover:bg-muted/40 flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
                        {item.question}
                        <ChevronDownIcon className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <p className="text-muted-foreground px-5 pb-5 text-sm leading-relaxed whitespace-pre-line">{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">{t.empty}</p>
        )}
        <div className="bg-card mt-12 max-w-3xl rounded-xl border p-6">
          <h2 className="font-semibold">{t.stillStuck}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t.stillStuckBody}{" "}
            <Link href="/how-it-works" className="text-primary underline-offset-4 hover:underline">
              {m.nav.howItWorks}
            </Link>
          </p>
        </div>
      </Section>
      {faq.sections.length ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} /> : null}
    </>
  );
}
