"use client";

import { useState, useTransition } from "react";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { reportDownloadAction } from "@/lib/reports/actions";

export function DownloadReportButton({ reportId }: { reportId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ text: string; upgrade?: boolean } | null>(null);
  return (
    <div className="grid justify-items-start gap-1">
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await reportDownloadAction(reportId);
            if ("url" in result) window.location.href = result.url;
            else setError({ text: result.error, upgrade: result.upgrade });
          })
        }
      >
        <DownloadIcon aria-hidden="true" />
        {pending ? "Preparing…" : "Download PDF"}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive max-w-xs text-xs">
          {error.text}
          {error.upgrade ? (
            <>
              {" "}
              <a href="/app/billing" className="font-medium underline underline-offset-4">
                Upgrade to Pro
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
