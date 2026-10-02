import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { cohort, isActive, ownedTeam } from "@/lib/teams/service";

export const metadata: Metadata = { title: "Team" };

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });

/** For a programme's contact: how each founder in their cohort is progressing. */
export default async function TeamPage() {
  const user = await getCurrentUser();
  const team = user ? await ownedTeam(user.id) : null;
  if (!team) notFound();
  const members = await cohort(team.id);
  const scored = members.filter((m) => m.score !== null);
  const average = scored.length ? Math.round(scored.reduce((s, m) => s + (m.score ?? 0), 0) / scored.length) : null;

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
        <p className="text-muted-foreground mt-1">
          {members.length} of {team.seats} seats used · Pro Plus for members {isActive(team) ? "until" : "ended"}{" "}
          {dateFormat.format(new Date(team.ends_at))}. To add seats, change the dates or get a new join link, contact RaiseReady.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Founders", value: members.length },
          { label: "Assessed", value: scored.length },
          { label: "Average score", value: average ?? "–" },
          { label: "Practice meetings", value: members.reduce((s, m) => s + m.simulations, 0) },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-xl border p-4">
            <dt className="text-muted-foreground text-xs">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      {members.length ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <caption className="sr-only">Founders in {team.name}</caption>
            <thead className="bg-muted/40 text-muted-foreground text-start text-xs">
              <tr>
                {["Founder", "Startup", "Readiness", "Practice meetings", "Last active"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2 text-start font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((m) => (
                <tr key={m.userId}>
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap">{m.name}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{m.startup ?? "–"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{m.score === null ? "Not assessed yet" : `${m.score} · ${m.band}`}</td>
                  <td className="px-4 py-2.5 tabular-nums">{m.simulations}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{m.lastSeen ? dateFormat.format(new Date(m.lastSeen)) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Nobody has joined yet. Share the join link RaiseReady gave you with your founders.</p>
      )}
      <p className="text-muted-foreground text-xs">
        Founders agreed to share this summary when they joined. Their documents, answers and reports stay private.
      </p>
    </div>
  );
}
