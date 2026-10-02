import Link from "next/link";

import { AppFooter } from "@/components/app/app-footer";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/admin/auth";
import { can, roleLabel, type StaffAction } from "@/lib/admin/permissions";
import { logout } from "@/lib/auth/actions";
import { Logo } from "@/components/brand/logo";

const NAV: { href: string; label: string; needs: StaffAction }[] = [
  { href: "/admin", label: "Overview", needs: "view" },
  { href: "/admin/analytics", label: "Analytics", needs: "view" },
  { href: "/admin/users", label: "Users", needs: "view" },
  { href: "/admin/simulations", label: "Simulations", needs: "view" },
  { href: "/admin/payments", label: "Payments", needs: "view" },
  { href: "/admin/ai-usage", label: "AI usage", needs: "view" },
  { href: "/admin/insights", label: "Insights", needs: "view" },
  { href: "/admin/errors", label: "Errors", needs: "view" },
  { href: "/admin/notifications", label: "Notifications", needs: "notify" },
  { href: "/admin/discounts", label: "Discounts", needs: "manage_discounts" },
  { href: "/admin/website", label: "Website", needs: "manage_content" },
  { href: "/admin/faq", label: "FAQ", needs: "manage_content" },
  { href: "/admin/report-signature", label: "Report signature", needs: "manage_content" },
];

export const metadata = { title: { default: "Admin", template: "%s | RaiseReady admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const staff = await requireStaff();
  return (
    <div lang="en" dir="ltr" className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/admin" aria-label="RaiseReady admin overview" className="inline-flex shrink-0 items-center gap-2">
            <Logo className="h-8" />
            <span className="bg-primary text-primary-foreground rounded px-1.5 py-0.5 text-xs font-semibold">Admin</span>
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
          {NAV.filter((n) => can(staff.profile.role, n.needs)).map((n) => (
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
