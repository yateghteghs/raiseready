import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { ReportView } from "@/components/reports/report-view";
import { Button } from "@/components/ui/button";
import { openShare } from "@/lib/reports/shares";

export const metadata: Metadata = {
  title: "Shared readiness report",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric" });

/** A read-only report a founder shared, e.g. with an investor. No account needed. */
export default async function SharedReportPage({ params }: PageProps<"/shared/[token]">) {
  const { token } = await params;
  const shared = await openShare(token);
  if (!shared) notFound();

  return (
    <div lang="en" dir="ltr" className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="RaiseReady home">
            <Logo />
          </Link>
          <Button asChild size="sm" variant="outline">
            <Link href="/register">Get your own report</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 px-4 py-8 sm:px-6">
        <p className="bg-accent text-accent-foreground rounded-xl p-4 text-sm">
          Shared by the founder of {shared.content.startup.name} through RaiseReady. This link works until{" "}
          {dateFormat.format(new Date(shared.expiresAt))}. It&apos;s an AI-assisted readiness assessment for practice, not
          investment advice or an endorsement.
        </p>
        <ReportView content={shared.content} logoUrl={shared.logoUrl} />
      </main>
    </div>
  );
}
