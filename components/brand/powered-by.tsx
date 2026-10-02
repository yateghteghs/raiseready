import Image from "next/image";

import { cn } from "@/lib/utils";
import indexPrima from "@/public/brand/indexprima-logo.png";

/** "Powered by Index Prima", with the company logo. */
export function PoweredBy({ label = "Powered by", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("text-muted-foreground inline-flex items-center gap-2 text-xs", className)}>
      {label}
      <Image src={indexPrima} alt="Index Prima" className="h-5 w-auto" />
    </span>
  );
}
