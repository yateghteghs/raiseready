"use client";

import { useTransition } from "react";

import { setCurrencyAction } from "@/lib/currency/actions";

/** Switches displayed (and charged) prices between naira and US dollars. */
export function CurrencySwitch({ to, label }: { to: "NGN" | "USD"; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setCurrencyAction(to))}
      className="text-primary text-sm font-medium underline-offset-4 hover:underline disabled:opacity-60"
    >
      {label}
    </button>
  );
}
