import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t find that</h1>
      <p className="text-muted-foreground">
        It may have been deleted, or the link may belong to another account.
      </p>
      <Button asChild>
        <Link href="/app">Go to your dashboard</Link>
      </Button>
    </div>
  );
}
