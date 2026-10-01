import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Account deleted", robots: { index: false } };

export default function AccountDeletedPage() {
  return (
    <section className="mx-auto grid max-w-xl gap-4 px-4 py-24 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Your account has been deleted</h1>
      <p className="text-muted-foreground">
        Your profile, startup, documents, assessments, simulations and reports have been permanently removed. Thank you for
        practising with RaiseReady, and good luck with your raise.
      </p>
      <Button asChild className="justify-self-start">
        <Link href="/">Back to the home page</Link>
      </Button>
    </section>
  );
}
