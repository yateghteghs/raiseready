import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getMessages();
  return { title: m.auth.forgot.title };
}

export default async function ForgotPasswordPage() {
  const { m } = await getMessages();
  const t = m.auth.forgot;
  return (
    <AuthCard
      title={t.title}
      description={t.description}
      footer={
        <Link href="/login" className="text-foreground font-medium underline-offset-4 hover:underline">
          {t.back}
        </Link>
      }
    >
      <ForgotPasswordForm t={m.auth} />
    </AuthCard>
  );
}
