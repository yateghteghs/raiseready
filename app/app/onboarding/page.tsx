import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppFooter } from "@/components/app/app-footer";
import { AppHeader } from "@/components/app/app-header";
import { LoadProblem } from "@/components/app/load-problem";
import { OnboardingForm } from "@/components/startup/onboarding-form";
import { isStaffProfile } from "@/lib/admin/auth";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { load } from "@/lib/data-errors";
import { toFormValues } from "@/lib/startups/schema";
import { getMyStartup } from "@/lib/startups/service";

export const metadata: Metadata = { title: "Set up your startup" };

export default async function OnboardingPage() {
  const user = await requireUser("/app/onboarding");
  const loaded = await load(() => Promise.all([getCurrentProfile(), getMyStartup()]));
  if (!loaded.ok) {
    return (
      <>
        <AppHeader email={user.email} />
        <LoadProblem code={loaded.code} />
      </>
    );
  }
  const [profile, startup] = loaded.data;
  if (profile?.onboarding_complete) redirect("/app");
  const staff = isStaffProfile(profile);

  return (
    <>
      <AppHeader email={user.email} admin={staff} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Tell us about your startup</h1>
          <p className="text-muted-foreground mt-1">
            Four quick steps. You can change any of this later.
          </p>
        </div>
        {staff ? (
          <p role="note" className="border-primary/30 bg-accent mb-6 rounded-xl border px-4 py-3 text-sm">
            You&apos;re staff, so you don&apos;t need to set up a startup to work in the admin area.{" "}
            <Link href="/admin" className="font-medium underline underline-offset-4">
              Go to Admin
            </Link>
          </p>
        ) : null}
        <OnboardingForm initialValues={toFormValues(startup, profile)} />
      </main>
      <AppFooter />
    </>
  );
}
