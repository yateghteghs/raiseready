"use client";

import { useActionState, useState, useTransition } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, SelectField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { inviteStaffAction, newStaffLinkAction, type InviteState } from "@/lib/admin/staff-actions";

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-2">
      <input readOnly value={link} aria-label="Sign-in link" className="bg-muted w-full rounded-md border px-3 py-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="justify-self-start"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}

/** Creates a staff account and shows the one-time link to send them. */
export function StaffInviteForm({ roles }: { roles: { value: string; label: string }[] }) {
  const [state, action] = useActionState<InviteState, FormData>(inviteStaffAction, { status: "idle" });
  return (
    <form action={action} noValidate className="bg-card grid gap-4 rounded-xl border p-5">
      <div>
        <h2 className="font-semibold">Invite a staff member</h2>
        <p className="text-muted-foreground text-sm">
          Staff don&apos;t sign up on the website. Create their account here; we email them a link (when email is set
          up) and show it to you too. They choose a password and go straight to the admin area.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="full_name" label="Name" defaultValue={state.values?.full_name} errors={state.fieldErrors} />
        <TextField name="email" label="Email" type="email" defaultValue={state.values?.email} errors={state.fieldErrors} />
        <SelectField name="role" label="Role" options={roles} defaultValue={state.values?.role ?? roles[0]?.value} errors={state.fieldErrors} />
      </div>
      <FormMessage status={state.status} message={state.message} />
      {state.link ? <CopyLink link={state.link} /> : null}
      <SubmitButton pendingText="Creating…" className="justify-self-start">
        Create staff account
      </SubmitButton>
    </form>
  );
}

/** A fresh one-time sign-in link, for staff who haven't set a password or are locked out. */
export function StaffLinkButton({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ link?: string; emailed?: boolean; error?: string } | null>(null);
  return (
    <div className="grid gap-2">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => start(async () => setResult(await newStaffLinkAction(userId)))}>
        {pending ? "Creating…" : "New sign-in link"}
      </Button>
      {result?.error ? (
        <p role="alert" className="text-destructive text-xs">
          {result.error}
        </p>
      ) : null}
      {result?.link ? (
        <>
          {result.emailed ? <p className="text-muted-foreground text-xs">Emailed to them. Here it is too:</p> : null}
          <CopyLink link={result.link} />
        </>
      ) : null}
    </div>
  );
}
