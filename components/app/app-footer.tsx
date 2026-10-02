import Link from "next/link";

import { PoweredBy } from "@/components/brand/powered-by";
import { SITE } from "@/lib/site";

const LINKS = [
  { href: "/", label: "Website" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

/** Footer for signed-in pages. */
export function AppFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="text-muted-foreground mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="grid gap-1">
          <PoweredBy />
          <p className="text-xs">
            &copy; {new Date().getFullYear()} {SITE.company.name} ({SITE.company.registration}). {SITE.name} is a product of{" "}
            {SITE.company.name}.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
