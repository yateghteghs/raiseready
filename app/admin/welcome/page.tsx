import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Logo } from "@/components/brand/logo";
import { getStaff } from "@/lib/admin/auth";
import { roleLabel } from "@/lib/admin/permissions";
import { DICTIONARIES } from "@/lib/i18n/messages";

export const metadata: Metadata = { title: "Welcome to RaiseReady admin", robots: { index: false } };

/** Where staff invite and sign-in links land: they choose a password, then go to the admin area. */
export default async function StaffWelcomePage() {
  const staff = await getStaff();

  return (
    <div lang="en" dir="ltr" className="bg-muted/40 flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
        <Link href="/" aria-label="RaiseReady home" className="inline-flex items-center gap-2">
          <Logo />
          <span className="bg-primary text-primary-foreground rounded px-1.5 py-0.5 text-xs font-semibold">Admin</span>
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-12">
        {staff ? (
          <AuthCard
            title="Welcome to the RaiseReady team"
            description={`You've been added as ${roleLabel(staff.profile.role)}${staff.email ? ` (${staff.email})` : ""}. Choose a password to finish.`}
            footer={
              <Link href="/admin" className="text-foreground font-medium underline-offset-4 hover:underline">
                Skip for now and go to Admin
              </Link>
            }
          >
            <ResetPasswordForm t={DICTIONARIES.en.auth} next="/admin" />
          </AuthCard>
        ) : (
          <AuthCard
            title="This link has expired"
            description="Staff sign-in links work once and expire after a while."
            footer={
              <Link href="/admin/login" className="text-foreground font-medium underline-offset-4 hover:underline">
                Admin sign-in
              </Link>
            }
          >
            <p className="text-muted-foreground text-sm">Ask a super admin for a new sign-in link, or sign in if you already have a password.</p>
          </AuthCard>
        )}
      </main>
    </div>
  );
}
