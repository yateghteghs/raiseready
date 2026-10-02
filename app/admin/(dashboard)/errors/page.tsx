import Link from "next/link";

import { PageTitle, Table } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireStaff } from "@/lib/admin/auth";
import { emailsById, recentErrors } from "@/lib/admin/data";

export const metadata = { title: "Errors" };

const dateTime = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function ErrorsPage({ searchParams }: PageProps<"/admin/errors">) {
  await requireStaff("view", "/admin/errors");
  const params = await searchParams;
  const reference = typeof params.ref === "string" ? params.ref.trim().slice(0, 100) : "";
  const [errors, emails] = await Promise.all([recentErrors(reference || undefined), emailsById()]);
  return (
    <>
      <PageTitle
        title="Errors"
        description="Things that went wrong on the live site, newest first (last 100, kept 90 days). When a founder sends you the Reference from an error screen, search for it here."
      />
      <form role="search" className="flex max-w-md gap-2">
        <label htmlFor="ref" className="sr-only">
          Reference
        </label>
        <Input id="ref" name="ref" defaultValue={reference} placeholder="Reference, e.g. 1037695728" inputMode="numeric" />
        <Button type="submit" variant="outline">
          Find
        </Button>
        {reference ? (
          <Button asChild variant="ghost">
            <Link href="/admin/errors">Clear</Link>
          </Button>
        ) : null}
      </form>
      <Table
        caption="Recent errors"
        rows={errors}
        empty={reference ? "No error with that reference. It may be older than 90 days, or it happened before error logging started." : "No errors recorded. 🎉"}
        columns={[
          { header: "When", cell: (e) => dateTime.format(new Date(e.created_at)) },
          { header: "Where", cell: (e) => (e.source === "browser" ? "Browser" : `Server${e.route_type ? ` (${e.route_type})` : ""}`) },
          { header: "Page", cell: (e) => <code className="text-xs">{e.path ?? ""}</code> },
          { header: "What happened", cell: (e) => <span className="block max-w-md truncate whitespace-normal" title={e.message}>{e.message}</span> },
          { header: "User", cell: (e) => (e.user_id ? <Link href={`/admin/users/${e.user_id}`} className="underline-offset-4 hover:underline">{emails.get(e.user_id) ?? "View"}</Link> : "") },
          { header: "Reference", cell: (e) => <code className="text-xs">{e.digest ?? ""}</code> },
        ]}
      />
    </>
  );
}
