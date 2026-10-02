"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { newJoinLinkAction, removeMemberAction, setEnquiryStatusAction, turnOffJoinLinkAction } from "@/lib/teams/actions";

/** Creates a join link (shown once, since only its hash is kept) or turns it off. */
export function JoinLinkControls({ teamId, linkOn }: { teamId: string; linkOn: boolean }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="grid gap-3">
      {url ? (
        <div className="grid gap-2">
          <p className="text-sm">Share this link with the cohort. It is shown only now; create a new one if you lose it.</p>
          <div className="flex gap-2">
            <Input readOnly value={url} aria-label="Join link" onFocus={(e) => e.currentTarget.select()} />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {linkOn ? "A join link is on. For security it can't be shown again: create a new one to share it (the old one stops working)." : "No join link is on."}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await newJoinLinkAction(teamId);
              setError(result.error ?? null);
              setUrl(result.url ?? null);
              setCopied(false);
            })
          }
        >
          {linkOn || url ? "Create a new link" : "Create join link"}
        </Button>
        {linkOn || url ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Turn off the join link? Nobody else can join until you create a new one.")) return;
              start(async () => {
                await turnOffJoinLinkAction(teamId);
                setUrl(null);
              });
            }}
          >
            Turn off link
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RemoveMemberButton({ teamId, userId, name }: { teamId: string; userId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Remove ${name} from the team? They lose Pro Plus straight away.`)) start(() => removeMemberAction(teamId, userId));
      }}
    >
      Remove
    </Button>
  );
}

export function EnquiryStatus({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <NativeSelect
      aria-label="Status"
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.currentTarget.value;
        start(() => setEnquiryStatusAction(id, next));
      }}
      className="h-8 w-32 text-sm"
    >
      <option value="new">New</option>
      <option value="contacted">Contacted</option>
      <option value="closed">Closed</option>
    </NativeSelect>
  );
}
