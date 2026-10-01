import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AuthCard
        title="Link expired"
        description="This password reset link is invalid or has expired."
        footer={
          <Link href="/forgot-password" className="text-foreground font-medium underline-offset-4 hover:underline">
            Request a new link
          </Link>
        }
      >
        <p className="text-muted-foreground text-sm">
          Reset links can only be used once and expire after a short time.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password" description={user.email ? `For ${user.email}` : undefined}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
