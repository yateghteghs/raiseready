import Link from "next/link";

import { AppFooter } from "@/components/app/app-footer";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/admin/auth";
import { roleLabel } from "@/lib/admin/permissions";
import { logout } from "@/lib/auth/actions";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/simulations", label: "Simulations" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/ai-usage", label: "AI usage" },
  { href: "/admin/insights", label: "Insights" },
];

export const metadata = { title: { default: "Admin", template: "%s | RaiseReady admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const staff = await requireStaff();
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/admin" className="font-semibold tracking-tight">
            RaiseReady <span className="bg-primary text-primary-foreground ml-1 rounded px-1.5 py-0.5 text-xs">Admin</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground hidden truncate md:inline">
              {staff.email} · {roleLabel(staff.profile.role)}
            </span>
            <Link href="/app" className="text-muted-foreground hover:text-foreground">
              Back to app
            </Link>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                Log out
              </Button>
            </form>
          </div>
        </div>
        <nav aria-label="Admin" className="mx-auto flex max-w-6xl gap-5 overflow-x-auto px-4 pb-3 text-sm sm:px-6">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-muted-foreground hover:text-foreground shrink-0">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 content-start gap-8 px-4 py-8 sm:px-6">{children}</main>
      <AppFooter />
    </div>
  );
}
