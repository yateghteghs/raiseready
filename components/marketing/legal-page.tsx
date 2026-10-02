import { SITE } from "@/lib/site";

export const LAST_UPDATED = "1 October 2026";

/** The contact address, or a visible placeholder until one is chosen. */
export function ContactEmail() {
  return SITE.contactEmail ? (
    <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
  ) : (
    <strong>[contact email to be added]</strong>
  );
}

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article lang="en" dir="ltr" className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <div
        role="note"
        className="border-warning bg-warning/15 mb-8 rounded-lg border px-4 py-3 text-sm font-medium"
      >
        DRAFT: requires legal review. This text has not yet been reviewed by a lawyer.
      </div>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">Last updated: {LAST_UPDATED}</p>
      <div className="text-foreground/90 mt-10 grid gap-4 leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:grid [&_ul]:gap-2">
        {children}
      </div>
    </article>
  );
}
