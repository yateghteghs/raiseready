import { redirect } from "next/navigation";
import { after } from "next/server";

import { AppFooter } from "@/components/app/app-footer";
import { touchActivity } from "@/lib/activity/service";
import { AppHeader } from "@/components/app/app-header";
import { isStaffProfile } from "@/lib/admin/auth";
import { LoadProblem } from "@/components/app/load-problem";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { load } from "@/lib/data-errors";
import { imageLink } from "@/lib/images/service";
import { unreadCount } from "@/lib/notifications/service";

const NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/startup", label: "Startup" },
  { href: "/app/documents", label: "Documents" },
  { href: "/app/assessment", label: "Assessment" },
  { href: "/app/investor-room", label: "Investor Room" },
  { href: "/app/reports", label: "Reports" },
  { href: "/app/decks", label: "Pitch deck" },
  { href: "/app/progress", label: "Progress" },
  { href: "/app/billing", label: "Billing" },
  { href: "/app/settings", label: "Settings" },
];

/** Signed-in pages that need onboarding to be finished first. */
export default async function MainAppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();
  const loaded = await load(() => getCurrentProfile());
  if (!loaded.ok) {
    return (
      <>
        <AppHeader email={user.email} />
        <LoadProblem code={loaded.code} />
      </>
    );
  }
  if (!loaded.data?.onboarding_complete) redirect("/app/onboarding");
  const { id, last_seen_at } = loaded.data;
  after(() => touchActivity(id, last_seen_at));
  const [avatarUrl, unread] = await Promise.all([
    imageLink(loaded.data.id, loaded.data.avatar_path),
    unreadCount(loaded.data.id, loaded.data.created_at),
  ]);

  return (
    <>
      <AppHeader email={user.email} nav={NAV} admin={isStaffProfile(loaded.data)} avatarUrl={avatarUrl} unread={unread} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <AppFooter />
    </>
  );
}
