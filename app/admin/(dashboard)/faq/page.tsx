import Link from "next/link";

import { FaqForm } from "@/components/admin/faq-form";
import { FaqItemActions } from "@/components/admin/faq-item-actions";
import { PageTitle } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { allFaq } from "@/lib/faq/service";
import { DEFAULT_LOCALE, isLocale, LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export const metadata = { title: "FAQ" };

export default async function AdminFaqPage({ searchParams }: PageProps<"/admin/faq">) {
  await requireStaff("manage_content", "/admin/faq");
  const params = await searchParams;
  const lang: Locale = isLocale(params.lang) ? params.lang : DEFAULT_LOCALE;
  const editId = typeof params.edit === "string" ? params.edit : null;
  const translateSlug = typeof params.translate === "string" ? params.translate : null;

  const [items, english] = await Promise.all([allFaq(lang), lang === DEFAULT_LOCALE ? null : allFaq(DEFAULT_LOCALE)]);
  const translated = new Set(items.map((i) => i.slug).filter(Boolean));
  const untranslated = (english ?? []).filter((e) => e.slug && !translated.has(e.slug));
  const editing = editId ? items.find((i) => i.id === editId) : undefined;
  const source = translateSlug ? english?.find((e) => e.slug === translateSlug) : undefined;
  const href = (extra: Record<string, string> = {}) => `/admin/faq?${new URLSearchParams({ lang, ...extra })}`;
  const name = LOCALE_NAMES[lang].english;

  return (
    <>
      <PageTitle
        title="FAQ"
        description="Questions and answers on the public FAQ page. Founders see their language's published entries, or the English ones if their language has none yet."
      />
      <nav aria-label="Language" className="-mt-2 flex flex-wrap gap-2">
        {LOCALES.map((l) => (
          <Link
            key={l}
            href={`/admin/faq?lang=${l}`}
            aria-current={l === lang ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-sm", l === lang ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}
          >
            {LOCALE_NAMES[l].english}
          </Link>
        ))}
      </nav>

      <section className="bg-card grid gap-4 rounded-xl border p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            {editing ? "Edit question" : source ? `Translate into ${name}` : `Add a question in ${name}`}
          </h2>
          {editing || source ? (
            <Link href={href()} className="text-sm underline underline-offset-4">
              Cancel
            </Link>
          ) : null}
        </div>
        {source ? (
          <div className="bg-muted/40 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground text-xs">English original</p>
            <p className="font-medium">{source.question}</p>
            <p className="text-muted-foreground mt-1 whitespace-pre-line">{source.answer}</p>
          </div>
        ) : null}
        {editing ? (
          <FaqForm key={editing.id} id={editing.id} locale={lang} initial={editing} submitLabel="Save" />
        ) : source ? (
          <FaqForm key={source.id} locale={lang} initial={{ ...source, category: "", question: "", answer: "" }} submitLabel="Add translation" />
        ) : (
          <FaqForm key={lang} locale={lang} submitLabel="Add" />
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-semibold">
          {name} <span className="text-muted-foreground font-normal">({items.length})</span>
        </h2>
        {items.length ? (
          <ul className="divide-y rounded-xl border" dir={lang === "ar" ? "rtl" : undefined}>
            {items.map((i) => (
              <li key={i.id} className="grid gap-2 p-4">
                <p className="text-muted-foreground text-xs">
                  {i.category} · order {i.position} ·{" "}
                  <span className={i.published ? "text-primary" : undefined}>{i.published ? "Published" : "Draft"}</span>
                </p>
                <p className="font-medium">{i.question}</p>
                <p className="text-muted-foreground line-clamp-2 text-sm">{i.answer}</p>
                <div className="flex flex-wrap items-center gap-1" dir="ltr">
                  <Link href={href({ edit: i.id })} className="hover:bg-muted rounded-md px-3 py-1.5 text-sm font-medium">
                    Edit
                  </Link>
                  <FaqItemActions id={i.id} published={i.published} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No {name} entries yet{lang === DEFAULT_LOCALE ? "." : ", so the English FAQ is shown to founders using this language."}
          </p>
        )}
      </section>

      {untranslated.length ? (
        <section className="grid gap-3">
          <h2 className="font-semibold">
            Not yet in {name} <span className="text-muted-foreground font-normal">({untranslated.length})</span>
          </h2>
          <p className="text-muted-foreground -mt-2 text-sm">
            Once a language has any published entries, only those are shown. Translate all of these before publishing, so nothing goes
            missing. Have a native speaker check each translation.
          </p>
          <ul className="divide-y rounded-xl border">
            {untranslated.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <p className="text-sm">{e.question}</p>
                <Link href={href({ translate: e.slug! })} className="text-sm font-medium underline underline-offset-4">
                  Translate
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
