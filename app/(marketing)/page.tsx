import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-4 py-20 sm:px-6 sm:py-28">
      <p className="text-primary text-sm font-medium">For African startup founders</p>
      <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Don&apos;t practice on investors. Practice on AI first.
      </h1>
      <p className="text-muted-foreground max-w-2xl text-lg">
        Upload your pitch deck, get a structured readiness assessment, then face an AI investor
        who questions you, follows up on weak answers and flags contradictions with your own
        documents.
      </p>
      <Button asChild size="lg">
        <Link href="/register">Test my readiness</Link>
      </Button>
    </section>
  );
}
