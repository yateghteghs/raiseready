"use client";

import { useTransition } from "react";

import { resetConsentAction } from "@/lib/consent-actions";

/** Footer link that brings the cookie notice back, to change the choice. */
export function CookieSettingsLink({ label, className }: { label: string; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => resetConsentAction())} className={`text-start ${className ?? ""}`}>
      {label}
    </button>
  );
}
