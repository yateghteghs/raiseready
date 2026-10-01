import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { FormMessage } from "@/components/forms/fields";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  const linkError = params.error === "link";
  const blocked = params.error === "suspended" || params.error === "terminated" ? params.error : null;

  return (
    <AuthCard
      title="Log in"
      description="Welcome back. Pick up where you left off."
      footer={
        <p>
          New to RaiseReady?{" "}
          <Link href="/register" className="text-foreground font-medium underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      <div className="grid gap-4">
        {linkError ? (
          <FormMessage
            status="error"
            message="That link is invalid or has expired. Log in, or request a new link."
          />
        ) : null}
        {blocked ? (
          <FormMessage
            status="error"
            message={
              blocked === "suspended"
                ? "Your account has been suspended, so you've been signed out. If you think this is a mistake, contact support."
                : "Your account has been closed, so you've been signed out. If you think this is a mistake, contact support."
            }
          />
        ) : null}
        <LoginForm next={next} />
      </div>
    </AuthCard>
  );
}
