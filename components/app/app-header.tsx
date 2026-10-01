import { BellIcon, UserIcon } from "lucide-react";
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

export function AppHeader({
  email,
  nav,
  admin = false,
  avatarUrl,
  unread = 0,
}: {
  email: string | null;
  nav?: NavItem[];
  admin?: boolean;
  avatarUrl?: string | null;
  unread?: number;
}) {
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
          {admin ? (
            <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm">
              Admin
            </Link>
          ) : null}
          <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
            Website
          </Link>
          {email ? (
            <span className="text-muted-foreground hidden max-w-48 truncate text-sm 2xl:inline">{email}</span>
          ) : null}
          {nav ? (
            <Link
              href="/app/notifications"
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
              className="text-muted-foreground hover:text-foreground relative flex size-8 items-center justify-center rounded-full"
            >
              <BellIcon aria-hidden="true" className="size-5" />
              {unread ? (
                <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
          ) : null}
          {nav ? (
            <Link
              href="/app/settings"
              aria-label="Your settings"
              className="bg-muted text-muted-foreground hover:ring-ring/40 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border hover:ring-2"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed link
                <img src={avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                <UserIcon aria-hidden="true" className="size-4" />
              )}
            </Link>
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
