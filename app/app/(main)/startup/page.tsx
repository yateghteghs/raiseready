import type { Metadata } from "next";

import { StartupProfileForm } from "@/components/startup/startup-profile-form";
import { getCurrentProfile } from "@/lib/auth/session";
import { toFormValues } from "@/lib/startups/schema";
import { getMyStartup } from "@/lib/startups/service";

export const metadata: Metadata = { title: "Startup profile" };

export default async function StartupPage() {
  const [startup, profile] = await Promise.all([getMyStartup(), getCurrentProfile()]);

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Startup profile</h1>
        <p className="text-muted-foreground mt-1">
          Keep this up to date. Your assessment and investor simulations use it alongside your
          documents.
        </p>
      </div>
      <StartupProfileForm initialValues={toFormValues(startup, profile)} />
    </div>
  );
}
