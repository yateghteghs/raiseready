import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/** A highlighted "what to do now" card that leads the founder to the next part of the journey. */
export function NextStep({
  title,
  children,
  href,
  cta,
  secondary,
}: {
  title: string;
  children: React.ReactNode;
  href: string;
  cta: string;
  secondary?: { href: string; label: string };
}) {
  return (
    <section
      aria-labelledby="next-step-heading"
      className="border-primary/30 bg-accent/60 flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="grid gap-1">
        <p className="text-primary text-xs font-semibold tracking-wide uppercase">Recommended next step</p>
        <h2 id="next-step-heading" className="font-semibold">
          {title}
        </h2>
        <div className="text-muted-foreground text-sm">{children}</div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {secondary ? (
          <Link href={secondary.href} className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline">
            {secondary.label}
          </Link>
        ) : null}
        <Button asChild>
          <Link href={href}>
            {cta}
            <ArrowRightIcon aria-hidden="true" className="rtl:rotate-180" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
