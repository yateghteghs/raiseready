import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { getMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getMessages();
  return { title: m.auth.register.title };
}

export default async function RegisterPage() {
  const { m } = await getMessages();
  const t = m.auth.register;
  // "{terms}" and "{privacy}" become links; the words around them come from the translation.
  const [before, middle, after] = t.agree.split(/\{terms\}|\{privacy\}/);
  const termsFirst = t.agree.indexOf("{terms}") < t.agree.indexOf("{privacy}");
  const terms = (
    <Link href="/terms" className="underline underline-offset-4">
      {t.terms}
    </Link>
  );
  const privacy = (
    <Link href="/privacy" className="underline underline-offset-4">
      {t.privacy}
    </Link>
  );

  return (
    <AuthCard
      title={t.title}
      description={t.description}
      footer={
        <p>
          {t.haveAccount}{" "}
          <Link href="/login" className="text-foreground font-medium underline-offset-4 hover:underline">
            {t.logIn}
          </Link>
        </p>
      }
    >
      <RegisterForm t={m.auth} />
      <p className="text-muted-foreground mt-4 text-xs">
        {before}
        {termsFirst ? terms : privacy}
        {middle}
        {termsFirst ? privacy : terms}
        {after}
      </p>
    </AuthCard>
  );
}
