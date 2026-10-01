import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";

const NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/startup", label: "Startup" },
];

/** Signed-in pages that need onboarding to be finished first. */
export default async function MainAppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  if (!profile?.onboarding_complete) redirect("/app/onboarding");

  return (
    <>
      <AppHeader email={user.email} nav={NAV} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
