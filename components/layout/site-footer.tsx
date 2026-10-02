import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { LanguagePicker } from "@/components/layout/language-picker";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/server";
import { MARKETING_NAV, SITE } from "@/lib/site";

export async function SiteFooter() {
  const { locale, m } = await getMessages();
  const link = "text-muted-foreground hover:text-foreground";
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-[2fr_1fr_1fr_1fr] sm:px-6">
        <div className="grid content-start gap-3">
          <Logo className="h-6" priority={false} />
          <p className="text-muted-foreground max-w-xs">{m.common.tagline}</p>
          <LanguagePicker locale={locale} label={m.common.changeLanguage} className="-ms-1" />
        </div>
        <nav aria-label="Product" className="grid content-start gap-2">
          <p className="font-medium">{m.footer.product}</p>
          {MARKETING_NAV.map((l) => (
            <Link key={l.href} href={l.href} className={link}>
              {m.nav[l.key]}
            </Link>
          ))}
        </nav>
        <nav aria-label="Company" className="grid content-start gap-2">
          <p className="font-medium">{m.footer.company}</p>
          <Link href="/about" className={link}>
            {m.nav.about}
          </Link>
          <Link href="/testimonials" className={link}>
            {m.footer.testimonials}
          </Link>
          <Link href="/partners" className={link}>
            {m.footer.partners}
          </Link>
        </nav>
        <nav aria-label="Legal" className="grid content-start gap-2">
          <p className="font-medium">{m.footer.legal}</p>
          <Link href="/privacy" className={link}>
            {m.footer.privacy}
          </Link>
          <Link href="/terms" className={link}>
            {m.footer.terms}
          </Link>
          {locale !== DEFAULT_LOCALE ? <p className="text-muted-foreground text-xs">{m.footer.legalInEnglish}</p> : null}
        </nav>
      </div>
      <div className="text-muted-foreground mx-auto max-w-6xl border-t px-4 py-6 text-xs sm:px-6">
        &copy; {new Date().getFullYear()} {SITE.name}
        {locale !== DEFAULT_LOCALE ? <span className="ms-2">· {m.common.reviewNotice}</span> : null}
      </div>
    </footer>
  );
}
