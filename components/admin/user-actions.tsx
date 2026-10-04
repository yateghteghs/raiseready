"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextField } from "@/components/forms/fields";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { userAdminAction } from "@/lib/admin/user-actions";
import { initialFormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

export type ActionKey =
  | "suspend"
  | "reactivate"
  | "terminate"
  | "delete"
  | "change_role"
  | "reset_password"
  | "grant_credits"
  | "confirm_email"
  | "resend_confirmation";

function ActionCard({
  userId,
  type,
  title,
  description,
  danger,
  children,
  submit,
  pending,
}: {
  userId: string;
  type: ActionKey;
  title: string;
  description: string;
  danger?: boolean;
  children?: React.ReactNode;
  submit: string;
  pending: string;
}) {
  const [state, action] = useActionState(userAdminAction.bind(null, userId), initialFormState);
  return (
    <form action={action} noValidate className={cn("bg-card grid content-start gap-3 rounded-xl border p-4", danger && "border-destructive/40")}>
      <input type="hidden" name="type" value={type} />
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
      {state.fieldErrors ? (
        <FormMessage status="error" message={Object.values(state.fieldErrors).flat()[0]} />
      ) : (
        <FormMessage status={state.status} message={state.message} />
      )}
      <SubmitButton pendingText={pending} className={cn("justify-self-start", danger && "bg-destructive hover:bg-destructive/90 text-white")}>
        {submit}
      </SubmitButton>
    </form>
  );
}

export function UserActions({
  userId,
  allowed,
  roles,
  currentRole,
}: {
  userId: string;
  allowed: Partial<Record<ActionKey, boolean>>;
  roles: { value: string; label: string; summary: string }[];
  currentRole: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {allowed.change_role ? (
        <ActionCard userId={userId} type="change_role" title="Role" description="What this person can do in the admin area." submit="Change role" pending="Saving…">
          <div className="grid gap-2">
            <Label htmlFor="role">New role</Label>
            <NativeSelect id="role" name="role" defaultValue={currentRole}>
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}: {r.summary}
                </option>
              ))}
            </NativeSelect>
          </div>
        </ActionCard>
      ) : null}
      {allowed.resend_confirmation ? (
        <ActionCard
          userId={userId}
          type="resend_confirmation"
          title="Confirmation email"
          description="They haven't confirmed their email yet. Send the confirmation link again (ask them to check spam too)."
          submit="Resend confirmation email"
          pending="Sending…"
        />
      ) : null}
      {allowed.confirm_email ? (
        <ActionCard
          userId={userId}
          type="confirm_email"
          title="Confirm email for them"
          description="If the email never arrives and you're sure the address is theirs, confirm it here. They can then log in straight away."
          submit="Confirm their email"
          pending="Confirming…"
        />
      ) : null}
      {allowed.grant_credits ? (
        <ActionCard
          userId={userId}
          type="grant_credits"
          title="Free credits"
          description="Adds simulation credits at no charge. Recorded in their history."
          submit="Add credits"
          pending="Adding…"
        >
          <TextField name="amount" label="How many" type="number" inputMode="numeric" min={1} max={100} defaultValue="3" className="max-w-32" />
          <TextField name="credit_reason" label="Reason (seen only by staff)" optional maxLength={500} />
        </ActionCard>
      ) : null}
      {allowed.reset_password ? (
        <ActionCard
          userId={userId}
          type="reset_password"
          title="Password"
          description="Emails them a link to choose a new password. You never see or set it. Their current password keeps working until they change it."
          submit="Send password reset email"
          pending="Sending…"
        />
      ) : null}
      {allowed.suspend ? (
        <ActionCard
          userId={userId}
          type="suspend"
          title="Suspend"
          description="Signs them out and blocks sign-in until reactivated. Their data is kept."
          submit="Suspend account"
          pending="Suspending…"
        >
          <TextField name="reason" label="Reason (seen only by staff)" optional maxLength={500} />
        </ActionCard>
      ) : null}
      {allowed.reactivate ? (
        <ActionCard userId={userId} type="reactivate" title="Reactivate" description="Lifts the suspension so they can sign in again." submit="Reactivate account" pending="Reactivating…" />
      ) : null}
      {allowed.terminate ? (
        <ActionCard
          userId={userId}
          type="terminate"
          title="Terminate"
          description="Permanently blocks this account. Data is kept for records, any Pro subscription is cancelled, and the email can't be used to sign up again. This can't be undone."
          danger
          submit="Terminate account"
          pending="Terminating…"
        >
          <TextField name="terminate_reason" label="Reason (seen only by staff)" optional maxLength={500} />
          <TextField name="confirm_terminate" label="Type TERMINATE to confirm" autoComplete="off" />
        </ActionCard>
      ) : null}
      {allowed.delete ? (
        <ActionCard
          userId={userId}
          type="delete"
          title="Delete"
          description="Erases the account and all its data and files, and cancels any Pro subscription. This can't be undone."
          danger
          submit="Delete account and data"
          pending="Deleting…"
        >
          <TextField name="confirm_delete" label="Type DELETE to confirm" autoComplete="off" />
        </ActionCard>
      ) : null}
    </div>
  );
}
