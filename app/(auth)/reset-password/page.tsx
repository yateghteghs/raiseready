import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getMessages } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/text";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getMessages();
  return { title: m.auth.reset.title };
}

export default async function ResetPasswordPage() {
  const [user, { m }] = await Promise.all([getCurrentUser(), getMessages()]);
  const t = m.auth.reset;

  if (!user) {
    return (
      <AuthCard
        title={t.expiredTitle}
        description={t.expiredDescription}
        footer={
          <Link href="/forgot-password" className="text-foreground font-medium underline-offset-4 hover:underline">
            {t.requestNew}
          </Link>
        }
      >
        <p className="text-muted-foreground text-sm">{t.expiredBody}</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t.title} description={user.email ? fill(t.forEmail, { email: user.email }) : undefined}>
      <ResetPasswordForm t={m.auth} />
    </AuthCard>
  );
}
