import { BellIcon, LogOutIcon, UserIcon } from "lucide-react";
import Link from "next/link";

import { AppNav, type NavItem } from "@/components/app/app-nav";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";
import { Logo } from "@/components/brand/logo";

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
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/app" aria-label="RaiseReady dashboard" className="shrink-0">
          <Logo className="h-6 min-[400px]:h-7 sm:h-9" />
        </Link>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {admin ? (
            <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm">
              Admin
            </Link>
          ) : null}
          <Link href="/" className="text-muted-foreground hover:text-foreground hidden text-sm sm:inline">
            Website
          </Link>
          {email ? (
            <span className="text-muted-foreground hidden max-w-48 truncate text-sm xl:inline">{email}</span>
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
            <Button type="submit" variant="outline" size="sm" aria-label="Log out">
              <LogOutIcon aria-hidden="true" className="size-4 sm:hidden" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </form>
        </div>
      </div>
      {nav ? <AppNav nav={nav} /> : null}
    </header>
  );
}
