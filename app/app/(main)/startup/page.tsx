import type { Metadata } from "next";

import { ImageUpload } from "@/components/images/image-upload";
import { StartupProfileForm } from "@/components/startup/startup-profile-form";
import { LoadProblem } from "@/components/app/load-problem";
import { getCurrentProfile } from "@/lib/auth/session";
import { load } from "@/lib/data-errors";
import { imageLink } from "@/lib/images/service";
import { toFormValues } from "@/lib/startups/schema";
import { getMyStartup } from "@/lib/startups/service";

export const metadata: Metadata = { title: "Startup profile" };

export default async function StartupPage() {
  const loaded = await load(async () => {
    const [startup, profile] = await Promise.all([getMyStartup(), getCurrentProfile()]);
    const logoUrl = startup ? await imageLink(startup.owner_id, startup.logo_path) : null;
    return { startup, profile, logoUrl };
  });
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  const { startup, profile, logoUrl } = loaded.data;

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Startup profile</h1>
        <p className="text-muted-foreground mt-1">
          Keep this up to date. Your assessment and investor simulations use it alongside your
          documents.
        </p>
      </div>
      {startup ? (
        <section aria-label="Company logo" className="bg-card rounded-xl border p-5">
          <ImageUpload
            kind="logo"
            label="Company logo"
            hint="PNG or JPEG, up to 2 MB. Shown on your startup profile and your PDF reports."
            url={logoUrl}
          />
        </section>
      ) : null}
      <StartupProfileForm initialValues={toFormValues(startup, profile)} />
    </div>
  );
}
