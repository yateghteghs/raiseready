import type { Metadata } from "next";
import Link from "next/link";

import { LoadProblem } from "@/components/app/load-problem";
import { AccountDetailsForm } from "@/components/settings/account-details-form";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { load } from "@/lib/data-errors";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const loaded = await load(async () => ({ user: await getCurrentUser(), profile: await getCurrentProfile() }));
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  const { user, profile } = loaded.data;

  return (
    <div className="grid gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Your account details and your data.</p>
      </div>

      <section aria-labelledby="account-h" className="bg-card grid gap-5 rounded-xl border p-5 sm:p-6">
        <div>
          <h2 id="account-h" className="text-lg font-semibold">Account</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Signed in as <span className="text-foreground font-medium">{user?.email}</span>. To change your password, log out and choose &ldquo;Forgot password&rdquo; on the login page.
          </p>
        </div>
        <AccountDetailsForm initialValues={{ full_name: profile?.full_name ?? "", country: profile?.country ?? "" }} />
      </section>

      <section aria-labelledby="delete-h" className="border-destructive/40 grid gap-5 rounded-xl border p-5 sm:p-6">
        <div className="grid gap-2">
          <h2 id="delete-h" className="text-lg font-semibold">Delete your account</h2>
          <p className="text-muted-foreground text-sm">This can&apos;t be undone. We will:</p>
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
            <li>cancel your Pro subscription with Paystack, if you have one (any unused Pro time and simulation credits will be lost)</li>
            <li>permanently delete your profile, startup, documents, assessments, simulations, reports and payment history</li>
            <li>keep a record that the deletion happened, without your name, email or startup details</li>
          </ul>
          <p className="text-muted-foreground text-sm">
            Want a copy first? Download your reports from the{" "}
            <Link href="/app/reports" className="underline underline-offset-4">
              Reports
            </Link>{" "}
            page and your files from{" "}
            <Link href="/app/documents" className="underline underline-offset-4">
              Documents
            </Link>
            . See the{" "}
            <Link href="/privacy" className="underline underline-offset-4">
              privacy policy
            </Link>{" "}
            for details.
          </p>
        </div>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
