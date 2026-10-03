import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { FormMessage } from "@/components/forms/fields";
import { safeNextPath } from "@/lib/auth/redirect";
import { getMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getMessages();
  return { title: m.auth.login.title };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const { m } = await getMessages();
  const t = m.auth.login;
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  const linkError = params.error === "link";
  const confirmed = params.confirmed === "1";
  const blocked = params.error === "suspended" || params.error === "terminated" ? params.error : null;

  return (
    <AuthCard
      title={t.title}
      description={t.description}
      footer={
        <p>
          {t.newHere}{" "}
          <Link href="/register" className="text-foreground font-medium underline-offset-4 hover:underline">
            {t.createAccount}
          </Link>
        </p>
      }
    >
      <div className="grid gap-4">
        {linkError ? <FormMessage status="error" message={t.linkError} /> : null}
        {confirmed ? <FormMessage status="success" message={t.confirmed} /> : null}
        {blocked ? <FormMessage status="error" message={blocked === "suspended" ? t.suspended : t.terminated} /> : null}
        <LoginForm next={next} t={m.auth} />
      </div>
    </AuthCard>
  );
}
