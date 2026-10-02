import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { JoinLinkControls, RemoveMemberButton } from "@/components/admin/team-controls";
import { TeamForm } from "@/components/admin/team-form";
import { adminDate, PageTitle, Table } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { emailsById } from "@/lib/admin/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { cohort, isActive } from "@/lib/teams/service";

export const metadata = { title: "Team" };

export default async function AdminTeamPage({ params }: PageProps<"/admin/teams/[teamId]">) {
  const { teamId } = await params;
  await requireStaff("manage_teams", `/admin/teams/${teamId}`);
  if (!z.uuid().safeParse(teamId).success) notFound();
  const { data: team } = await createAdminClient().from("teams").select("*").eq("id", teamId).maybeSingle();
  if (!team) notFound();
  const [members, emails] = await Promise.all([cohort(team.id, true), team.owner_id ? emailsById() : Promise.resolve(new Map<string, string>())]);
  const lagosDay = new Date(new Date(team.ends_at).getTime() + 3_600_000).toISOString().slice(0, 10);

  return (
    <>
      <Link href="/admin/teams" className="text-muted-foreground text-sm underline-offset-4 hover:underline">
        ← All teams
      </Link>
      <PageTitle
        title={team.name}
        description={`${members.length} of ${team.seats} seats used · ${isActive(team) ? "access ends" : "ended"} ${adminDate.format(new Date(team.ends_at))}`}
      />

      <section className="bg-card grid gap-3 rounded-xl border p-5">
        <h2 className="font-semibold">Join link</h2>
        <p className="text-muted-foreground -mt-2 text-sm">
          Founders who open it and sign in join the team and get Pro Plus. They&apos;re told that the programme contact can see their
          progress.
        </p>
        <JoinLinkControls teamId={team.id} linkOn={Boolean(team.join_token_hash)} />
      </section>

      <section className="grid gap-3">
        <h2 className="font-semibold">Members ({members.length})</h2>
        <Table
          caption="Members"
          rows={members}
          empty="Nobody has joined yet."
          columns={[
            { header: "Founder", cell: (m) => <span>{m.name}</span> },
            { header: "Email", cell: (m) => m.email ?? "–" },
            { header: "Startup", cell: (m) => m.startup ?? "–" },
            { header: "Score", cell: (m) => (m.score === null ? "–" : `${m.score} · ${m.band}`), align: "right" },
            { header: "Meetings", cell: (m) => m.simulations, align: "right" },
            { header: "Joined", cell: (m) => adminDate.format(new Date(m.joinedAt)) },
            { header: "", cell: (m) => <RemoveMemberButton teamId={team.id} userId={m.userId} name={m.name} /> },
          ]}
        />
      </section>

      <section className="grid gap-3">
        <h2 className="font-semibold">Details</h2>
        <TeamForm
          teamId={team.id}
          defaults={{
            name: team.name,
            seats: String(team.seats),
            ends_on: lagosDay,
            owner_email: team.owner_id ? (emails.get(team.owner_id) ?? "") : "",
            notes: team.notes ?? "",
          }}
        />
      </section>
    </>
  );
}
