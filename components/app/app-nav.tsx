"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };

/** The app's page links on their own row, scrolling sideways when they don't fit. */
export function AppNav({ nav, label = "App", home = "/app" }: { nav: NavItem[]; label?: string; home?: string }) {
  const pathname = usePathname();
  const active = (href: string) => (href === home ? pathname === home : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav aria-label={label} className="border-t">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 text-sm [scrollbar-width:none] sm:px-4">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active(item.href) ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-2 py-3 whitespace-nowrap transition-colors",
              active(item.href)
                ? "border-primary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
