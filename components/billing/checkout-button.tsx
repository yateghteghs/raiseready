"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { checkoutAction, manageSubscriptionAction } from "@/lib/billing/actions";

export function CheckoutButton({
  product,
  children,
  variant = "default",
}: {
  product: "pro_monthly" | "credits_3" | "credits_10" | "manage";
  children: React.ReactNode;
  variant?: "default" | "outline";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-1">
      <Button
        type="button"
        variant={variant}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = product === "manage" ? await manageSubscriptionAction() : await checkoutAction(product);
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? "Opening Paystack…" : children}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
