import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { LoadProblem } from "@/components/app/load-problem";
import { OnboardingForm } from "@/components/startup/onboarding-form";
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

  return (
    <>
      <AppHeader email={user.email} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Tell us about your startup</h1>
          <p className="text-muted-foreground mt-1">
            Four quick steps. You can change any of this later.
          </p>
        </div>
        <OnboardingForm initialValues={toFormValues(startup, profile)} />
      </main>
    </>
  );
}
