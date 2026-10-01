import Link from "next/link";

import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";

export function AppHeader({
  email,
  nav,
}: {
  email: string | null;
  nav?: { href: string; label: string }[];
}) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/app" className="text-lg font-semibold tracking-tight">
            RaiseReady
          </Link>
          {nav ? (
            <nav aria-label="App" className="flex items-center gap-4 text-sm">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {email ? (
            <span className="text-muted-foreground hidden max-w-48 truncate text-sm sm:inline">
              {email}
            </span>
          ) : null}
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Log out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
