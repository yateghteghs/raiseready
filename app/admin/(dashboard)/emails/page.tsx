import Link from "next/link";

import { PageTitle, Table } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireStaff } from "@/lib/admin/auth";
import { recentEmails } from "@/lib/admin/data";
import { emailConfigured } from "@/lib/email/mailtrap";

export const metadata = { title: "Emails" };

const dateTime = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function EmailsPage({ searchParams }: PageProps<"/admin/emails">) {
  await requireStaff("view", "/admin/emails");
  const params = await searchParams;
  const address = typeof params.to === "string" ? params.to.trim().slice(0, 320) : "";
  const emails = await recentEmails(address || undefined);
  return (
    <>
      <PageTitle
        title="Emails"
        description="Every email RaiseReady sent through Mailtrap, newest first (last 100, kept 90 days). 'Accepted' means Mailtrap took it; whether it reached the inbox (or spam) is in Mailtrap's Email Logs."
      />
      {!emailConfigured() ? (
        <p role="status" className="border-warning bg-warning/15 rounded-xl border p-4 text-sm">
          Email isn&apos;t set up: add MAILTRAP_API_TOKEN in Vercel. Until then nothing is sent from RaiseReady itself.
        </p>
      ) : null}
      <div className="bg-muted/40 grid gap-2 rounded-xl border p-4 text-sm">
        <p className="font-medium">Someone says an email never arrived?</p>
        <ol className="text-muted-foreground ms-5 list-decimal space-y-1">
          <li>Search for their address below. No row means RaiseReady didn&apos;t send it (for sign-up emails, check that Supabase&apos;s Send Email hook is on).</li>
          <li>&quot;Refused&quot; shows Mailtrap&apos;s reason, often that the domain isn&apos;t verified yet.</li>
          <li>
            &quot;Accepted&quot;: open{" "}
            <a href="https://mailtrap.io/sending/email_logs" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              Mailtrap&apos;s Email Logs
            </a>{" "}
            to see if it was delivered, bounced or went to spam. Ask them to check spam and mark it &quot;Not spam&quot;.
          </li>
          <li>To let them in now, open their account under Users and use &quot;Confirm their email&quot;.</li>
        </ol>
      </div>
      <form role="search" className="flex max-w-md gap-2">
        <label htmlFor="to" className="sr-only">
          Email address
        </label>
        <Input id="to" name="to" type="email" defaultValue={address} placeholder="name@example.com" />
        <Button type="submit" variant="outline">
          Find
        </Button>
        {address ? (
          <Button asChild variant="ghost">
            <Link href="/admin/emails">Clear</Link>
          </Button>
        ) : null}
      </form>
      <Table
        caption="Recent emails"
        rows={emails}
        empty={address ? "Nothing was emailed to that address in the last 90 days." : "No emails sent yet."}
        columns={[
          { header: "When", cell: (e) => dateTime.format(new Date(e.created_at)) },
          { header: "To", cell: (e) => e.to_email },
          { header: "Email", cell: (e) => e.category },
          { header: "From", cell: (e) => e.sender },
          {
            header: "Mailtrap",
            cell: (e) =>
              e.accepted ? <span>Accepted</span> : <span className="text-destructive font-medium">Refused: {e.reason ?? "no reason given"}</span>,
          },
        ]}
      />
    </>
  );
}
