import Link from "next/link";

import { MARKETING_NAV, SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-[2fr_1fr_1fr] sm:px-6">
        <div>
          <p className="font-semibold">{SITE.name}</p>
          <p className="text-muted-foreground mt-2 max-w-xs">{SITE.tagline}</p>
        </div>
        <nav aria-label="Product" className="grid content-start gap-2">
          <p className="font-medium">Product</p>
          {MARKETING_NAV.map((link) => (
            <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Legal" className="grid content-start gap-2">
          <p className="font-medium">Legal</p>
          <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="text-muted-foreground hover:text-foreground">
            Terms
          </Link>
        </nav>
      </div>
      <div className="text-muted-foreground mx-auto max-w-6xl border-t px-4 py-6 text-xs sm:px-6">
        &copy; {new Date().getFullYear()} {SITE.name}
      </div>
    </footer>
  );
}
