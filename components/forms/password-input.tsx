"use client";

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type RevealLabels = { show: string; hide: string };

/** A password box with an eye button that shows or hides what was typed. */
export function PasswordInput({
  className,
  labels = { show: "Show password", hide: "Hide password" },
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { labels?: RevealLabels }) {
  const [shown, setShown] = React.useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={shown ? "text" : "password"}
        className={cn("pe-10", className)}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? labels.hide : labels.show}
        aria-pressed={shown}
        aria-controls={props.id}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex w-10 items-center justify-center rounded-e-md outline-none focus-visible:ring-[3px]"
      >
        {shown ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
