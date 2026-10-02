"use client";

import { CheckIcon, CopyIcon, LinkIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { createShareAction, revokeShareAction } from "@/lib/reports/share-actions";
import type { ShareRow } from "@/lib/reports/shares";

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });

/** Create, copy and turn off read-only links to this report for investors. */
export function ShareReport({ reportId, shares }: { reportId: string; shares: ShareRow[] }) {
  const [days, setDays] = useState("30");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      setError(null);
      setCopied(false);
      const result = await createShareAction(reportId, Number(days));
      if ("error" in result) setError(result.error);
      else setUrl(result.url);
    });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  return (
    <section aria-labelledby="share-h" className="bg-card grid gap-4 rounded-xl border p-5">
      <div>
        <h2 id="share-h" className="flex items-center gap-2 text-lg font-semibold">
          <LinkIcon aria-hidden="true" className="size-4" /> Share with investors
        </h2>
        <p className="text-muted-foreground text-sm">
          Create a read-only link to this report. Anyone with the link can see everything on this page, including risks and
          red flags, until it expires or you turn it off. They don&apos;t need an account.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="share-days">Link works for</Label>
          <NativeSelect id="share-days" value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </NativeSelect>
        </div>
        <Button type="button" onClick={create} disabled={pending}>
          {pending ? "Creating…" : "Create link"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {url ? (
        <div className="grid gap-2" aria-live="polite">
          <p className="text-sm font-medium">Your link. Copy it now: for security we can&apos;t show it again.</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="bg-muted min-w-0 flex-1 truncate rounded-md px-3 py-2 text-sm" title={url}>
              {url}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={copy}>
              {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}
      {shares.length ? (
        <ul className="divide-y rounded-lg border text-sm">
          {shares.map((s) => {
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  Created {dateFormat.format(new Date(s.created_at))} ·{" "}
                  {s.state === "off" ? "turned off" : s.state === "expired" ? "expired" : `expires ${dateFormat.format(new Date(s.expires_at))}`} · {s.views}{" "}
                  {s.views === 1 ? "view" : "views"}
                  {s.last_viewed_at ? `, last ${dateFormat.format(new Date(s.last_viewed_at))}` : ""}
                </span>
                {s.state === "live" ? (
                  <form action={revokeShareAction.bind(null, reportId, s.id)}>
                    <Button type="submit" size="sm" variant="ghost">
                      Turn off
                    </Button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
