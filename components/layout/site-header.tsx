import Link from "next/link";
import { MenuIcon } from "lucide-react";

import { AuthActions } from "@/components/layout/auth-actions";
import { MARKETING_NAV, SITE } from "@/lib/site";
import { Logo } from "@/components/brand/logo";

export function SiteHeader() {
  return (
    <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={`${SITE.name} home`} className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 text-sm md:flex">
          {MARKETING_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <AuthActions />
          {/* Mobile menu: a native disclosure, so it works without JavaScript. */}
          <details className="group relative md:hidden">
            <summary
              aria-label="Menu"
              className="hover:bg-accent flex size-9 cursor-pointer list-none items-center justify-center rounded-md [&::-webkit-details-marker]:hidden"
            >
              <MenuIcon className="size-5" aria-hidden="true" />
            </summary>
            <nav
              aria-label="Mobile"
              className="bg-popover absolute right-0 mt-2 grid w-56 gap-1 rounded-lg border p-2 shadow-lg"
            >
              {MARKETING_NAV.map((link) => (
                <Link key={link.href} href={link.href} className="hover:bg-accent rounded-md px-3 py-2 text-sm">
                  {link.label}
                </Link>
              ))}
              <Link href="/login" className="hover:bg-accent rounded-md px-3 py-2 text-sm">
                Log in
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
