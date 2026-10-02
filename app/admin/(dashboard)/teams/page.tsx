import Link from "next/link";

import { EnquiryStatus } from "@/components/admin/team-controls";
import { TeamForm } from "@/components/admin/team-form";
import { adminDate, PageTitle, Table } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { listEnquiries, listTeams } from "@/lib/teams/service";

export const metadata = { title: "Teams" };

export default async function AdminTeamsPage() {
  await requireStaff("manage_teams", "/admin/teams");
  const [teams, enquiries] = await Promise.all([listTeams(), listEnquiries()]);
  return (
    <>
      <PageTitle
        title="Teams"
        description="Accelerators, hubs and programmes. Agree the price and invoice them directly; members get Pro Plus until the end date."
      />

      <section className="grid gap-3">
        <h2 className="font-semibold">Teams ({teams.length})</h2>
        <Table
          caption="Teams"
          rows={teams}
          empty="No teams yet."
          columns={[
            {
              header: "Team",
              cell: (t) => (
                <Link href={`/admin/teams/${t.id}`} className="font-medium underline-offset-4 hover:underline">
                  {t.name}
                </Link>
              ),
            },
            { header: "Seats used", cell: (t) => `${t.members} of ${t.seats}`, align: "right" },
            { header: "Ends", cell: (t) => adminDate.format(new Date(t.ends_at)) },
            { header: "Status", cell: (t) => (t.active ? "Active" : "Ended") },
            { header: "Join link", cell: (t) => (t.join_token_hash ? "On" : "Off") },
          ]}
        />
      </section>

      <section className="grid gap-3">
        <h2 className="font-semibold">New team</h2>
        <TeamForm />
      </section>

      <section className="grid gap-3">
        <h2 className="font-semibold">Enquiries from the Teams page ({enquiries.length})</h2>
        {enquiries.length ? (
          <ul className="divide-y rounded-xl border">
            {enquiries.map((e) => (
              <li key={e.id} className="grid gap-1 p-4 sm:grid-cols-[1fr_auto] sm:items-start">
                <div className="min-w-0">
                  <p className="font-medium">
                    {e.organisation} <span className="text-muted-foreground font-normal">· {e.name}</span>
                  </p>
                  <p className="text-sm">
                    <a href={`mailto:${e.email}`} className="underline underline-offset-4">
                      {e.email}
                    </a>
                    {e.cohort_size ? ` · about ${e.cohort_size} founders` : ""} · {adminDate.format(new Date(e.created_at))}
                  </p>
                  {e.message ? <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">{e.message}</p> : null}
                </div>
                <EnquiryStatus id={e.id} status={e.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No enquiries yet.</p>
        )}
      </section>
    </>
  );
}
