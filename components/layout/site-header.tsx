import Link from "next/link";
import { MenuIcon } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { AuthActions } from "@/components/layout/auth-actions";
import { LanguagePicker } from "@/components/layout/language-picker";
import { getMessages } from "@/lib/i18n/server";
import { MARKETING_NAV } from "@/lib/site";

export async function SiteHeader() {
  const { locale, m } = await getMessages();
  const authLabels = { logIn: m.common.logIn, getStarted: m.common.getStarted, goToDashboard: m.common.goToDashboard };
  return (
    <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={m.common.home} className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 text-sm lg:flex">
          {MARKETING_NAV.map((link) => (
            <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground transition-colors">
              {m.nav[link.key]}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguagePicker locale={locale} label={m.common.changeLanguage} className="hidden sm:flex" />
          <AuthActions labels={authLabels} />
          {/* Mobile menu: a native disclosure, so it works without JavaScript. */}
          <details className="group relative lg:hidden">
            <summary
              aria-label={m.common.menu}
              className="hover:bg-accent flex size-9 cursor-pointer list-none items-center justify-center rounded-md [&::-webkit-details-marker]:hidden"
            >
              <MenuIcon className="size-5" aria-hidden="true" />
            </summary>
            <nav aria-label="Mobile" className="bg-popover absolute end-0 mt-2 grid w-60 gap-1 rounded-lg border p-2 shadow-lg">
              {MARKETING_NAV.map((link) => (
                <Link key={link.href} href={link.href} className="hover:bg-accent rounded-md px-3 py-2 text-sm">
                  {m.nav[link.key]}
                </Link>
              ))}
              <Link href="/login" className="hover:bg-accent rounded-md px-3 py-2 text-sm">
                {m.common.logIn}
              </Link>
              <LanguagePicker locale={locale} label={m.common.changeLanguage} className="border-t px-2 pt-2 sm:hidden" />
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
