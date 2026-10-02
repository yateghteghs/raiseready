import Link from "next/link";

import { AppFooter } from "@/components/app/app-footer";
import { AppNav } from "@/components/app/app-nav";
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
  { href: "/admin/plans", label: "Plans", needs: "manage_discounts" },
  { href: "/admin/prices", label: "Prices", needs: "manage_discounts" },
  { href: "/admin/discounts", label: "Discounts", needs: "manage_discounts" },
  { href: "/admin/teams", label: "Teams", needs: "manage_teams" },
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
            <Link
              href={staff.profile.onboarding_complete ? "/app" : "/app/onboarding?founder=1"}
              className="text-muted-foreground hover:text-foreground"
            >
              {staff.profile.onboarding_complete ? "Back to app" : "Founder app"}
            </Link>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                Log out
              </Button>
            </form>
          </div>
        </div>
        <AppNav label="Admin" home="/admin" nav={NAV.filter((n) => can(staff.profile.role, n.needs)).map(({ href, label }) => ({ href, label }))} />
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 content-start gap-8 px-4 py-8 sm:px-6">{children}</main>
      <AppFooter />
    </div>
  );
}
