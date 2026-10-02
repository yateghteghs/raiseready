import { QuoteIcon } from "lucide-react";

import type { ShowcaseItem } from "@/lib/showcase/service";

function Logo({ item, className }: { item: ShowcaseItem; className: string }) {
  if (!item.imageUrl) return <span className="text-muted-foreground font-semibold">{item.name}</span>;
  // eslint-disable-next-line @next/next/no-img-element -- public storage image, sized by CSS
  const img = <img src={item.imageUrl} alt={item.name} loading="lazy" className={className} />;
  return item.url ? (
    <a href={item.url} target="_blank" rel="noopener noreferrer nofollow">
      {img}
    </a>
  ) : (
    img
  );
}

/** "Founders who practised with RaiseReady" strip of startup logos. */
export function LogoStrip({ items, title }: { items: ShowcaseItem[]; title: string }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="logos-h" className="border-b">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h2 id="logos-h" className="text-muted-foreground text-center text-sm font-medium">
          {title}
        </h2>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {items.map((i) => (
            <li key={i.id}>
              <Logo item={i} className="h-10 max-w-36 object-contain opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function TestimonialCards({ items }: { items: ShowcaseItem[] }) {
  return (
    <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map((t) => (
        <li key={t.id}>
          <figure className="bg-card flex h-full flex-col gap-4 rounded-xl border p-6">
            <QuoteIcon aria-hidden="true" className="text-primary size-6" />
            <blockquote className="flex-1 text-balance">&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption className="flex items-center gap-3">
              {t.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- public storage image
                <img src={t.imageUrl} alt="" loading="lazy" className="size-10 rounded-full border bg-white object-contain" />
              ) : null}
              <span className="text-sm">
                <span className="block font-medium">{t.person_name}</span>
                <span className="text-muted-foreground">{[t.person_title, t.name].filter(Boolean).join(", ")}</span>
              </span>
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}

export function PartnerGrid({ items }: { items: ShowcaseItem[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((p) => (
        <li key={p.id} className="bg-card flex flex-col items-center justify-center gap-3 rounded-xl border p-6 text-center">
          <Logo item={p} className="h-14 max-w-40 object-contain" />
          <span className="text-sm font-medium">{p.name}</span>
        </li>
      ))}
    </ul>
  );
}
