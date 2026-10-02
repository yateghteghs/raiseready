import Image from "next/image";

import { cn } from "@/lib/utils";
import logo from "@/public/brand/raiseready-logo.png";

/** The RaiseReady wordmark. Height comes from the class (default h-7); width follows. */
export function Logo({ className, priority = true }: { className?: string; priority?: boolean }) {
  return <Image src={logo} alt="RaiseReady" priority={priority} className={cn("h-7 w-auto", className)} />;
}
