"use client";

import { LanguagesIcon } from "lucide-react";

import { setLocaleAction } from "@/lib/i18n/actions";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/** Language menu. Changes as soon as a language is picked; without JavaScript, a button submits it. */
export function LanguagePicker({ locale, label, className }: { locale: Locale; label: string; className?: string }) {
  return (
    <form action={setLocaleAction} className={cn("flex items-center gap-1", className)}>
      <LanguagesIcon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      <select
        name="locale"
        defaultValue={locale}
        aria-label={label}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="hover:bg-accent focus-visible:ring-ring/50 h-8 cursor-pointer [field-sizing:content] rounded-md bg-transparent px-1 text-sm outline-none focus-visible:ring-[3px]"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l].native}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="rounded-md border px-2 py-1 text-xs">
          OK
        </button>
      </noscript>
    </form>
  );
}
