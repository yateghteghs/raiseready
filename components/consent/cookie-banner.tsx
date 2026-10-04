"use client";

import Link from "next/link";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { setConsentAction } from "@/lib/consent-actions";
import type { Messages } from "@/lib/i18n/messages/en";

/** Shown until the visitor accepts or declines. Saving the choice re-renders the page without it. */
export function CookieBanner({ t }: { t: Messages["cookies"] }) {
  const [pending, start] = useTransition();
  const choose = (choice: "all" | "essential") => start(() => setConsentAction(choice));
  return (
    <section
      role="region"
      aria-label={t.title}
      className="bg-background fixed inset-x-0 bottom-0 z-50 border-t shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm">
          {t.body}{" "}
          <Link href="/privacy" className="font-medium underline underline-offset-4">
            {t.privacy}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => choose("essential")}>
            {t.decline}
          </Button>
          <Button type="button" size="sm" disabled={pending} onClick={() => choose("all")}>
            {t.accept}
          </Button>
        </div>
      </div>
    </section>
  );
}
