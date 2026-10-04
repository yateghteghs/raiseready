import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { getMessages } from "@/lib/i18n/server";
import { isReferralCode, REFERRAL_COOKIE } from "@/lib/referrals/code";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getMessages();
  return { title: m.auth.register.title };
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const [{ m }, jar, { ref }] = await Promise.all([getMessages(), cookies(), searchParams]);
  // The invite link's code, from the link itself or the cookie it left.
  const fromLink = ref?.toUpperCase();
  const fromCookie = jar.get(REFERRAL_COOKIE)?.value;
  const inviteCode = isReferralCode(fromLink) ? fromLink : isReferralCode(fromCookie) ? fromCookie : undefined;
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
      <RegisterForm t={m.auth} inviteCode={inviteCode} />
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
