import Link from "next/link";

import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";

type NavItem = { href: string; label: string };

function NavLinks({ nav }: { nav: NavItem[] }) {
  return nav.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
    >
      {item.label}
    </Link>
  ));
}

export function AppHeader({ email, nav }: { email: string | null; nav?: NavItem[] }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/app" className="text-lg font-semibold tracking-tight">
            RaiseReady
          </Link>
          {nav ? (
            <nav aria-label="App" className="hidden items-center gap-4 text-sm lg:flex">
              <NavLinks nav={nav} />
            </nav>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
            Website
          </Link>
          {email ? (
            <span className="text-muted-foreground hidden max-w-48 truncate text-sm 2xl:inline">{email}</span>
          ) : null}
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Log out
            </Button>
          </form>
        </div>
      </div>
      {nav ? (
        <nav aria-label="App (mobile)" className="flex gap-5 overflow-x-auto border-t px-4 py-3 text-sm lg:hidden">
          <NavLinks nav={nav} />
        </nav>
      ) : null}
    </header>
  );
}
