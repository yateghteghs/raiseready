import type { Metadata } from "next";
import { connection } from "next/server";

import { runHealthChecks } from "@/lib/health";

export const metadata: Metadata = { title: "System status", robots: { index: false } };

/** Plain-language configuration check. Shows no secret values. */
export default async function StatusPage() {
  await connection();
  const results = await runHealthChecks();
  const allOk = results.every((r) => r.ok);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">System status</h1>
      <p className={allOk ? "text-primary mt-2 font-medium" : "text-destructive mt-2 font-medium"}>
        {allOk ? "Everything is configured." : "Some settings need attention."}
      </p>
      <ul className="mt-8 grid gap-3">
        {results.map((r) => (
          <li key={r.name} className="bg-card flex gap-3 rounded-lg border p-4">
            <span aria-hidden="true" className={r.ok ? "text-primary" : "text-destructive"}>
              {r.ok ? "✓" : "✕"}
            </span>
            <div>
              <p className="font-mono text-sm font-medium">{r.name}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                <span className="sr-only">{r.ok ? "OK: " : "Problem: "}</span>
                {r.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
