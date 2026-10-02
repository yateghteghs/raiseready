import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { AuthCard } from "@/components/auth/auth-card";
import { getStaff } from "@/lib/admin/auth";
import { safeNextPath } from "@/lib/auth/redirect";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Admin sign-in", robots: { index: false } };

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next, "/admin") : undefined;
  if (await getStaff()) redirect(next?.startsWith("/admin") ? next : "/admin");

  return (
    <div lang="en" dir="ltr" className="bg-muted/40 flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
        <Link href="/" aria-label="RaiseReady home" className="inline-flex items-center gap-2">
          <Logo />
          <span className="bg-primary text-primary-foreground rounded px-1.5 py-0.5 text-xs font-semibold">Admin</span>
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-12">
        <AuthCard
          title="Admin sign-in"
          description="For RaiseReady staff. Use your RaiseReady email and password."
          footer={
            <p>
              Not staff?{" "}
              <Link href="/login" className="text-foreground font-medium underline-offset-4 hover:underline">
                Founder login
              </Link>
            </p>
          }
        >
          <AdminLoginForm next={next} />
        </AuthCard>
      </main>
    </div>
  );
}
