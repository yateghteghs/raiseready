import { ImageIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { adminDate, num, PageTitle, Stat, StatGrid } from "@/components/admin/ui";
import { UserActions, type ActionKey } from "@/components/admin/user-actions";
import { requireStaff } from "@/lib/admin/auth";
import { userDetail } from "@/lib/admin/data";
import { ROLES, roleLabel, STATUS_LABELS, userActionProblem, type UserAction } from "@/lib/admin/permissions";
import { formatMoney, koboToNaira } from "@/lib/format";
import { labelFor, STAGE_OPTIONS } from "@/lib/startups/options";
import { cn } from "@/lib/utils";

export const metadata = { title: "User" };

const dateTime = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const HISTORY_LABELS: Record<string, string> = {
  "admin.user_suspended": "Suspended",
  "admin.user_reactivated": "Reactivated",
  "admin.user_terminated": "Terminated",
  "profile.role_changed": "Role changed",
  "billing.pro_started": "Pro started",
  "billing.pro_ended": "Pro ended",
  "billing.pro_renewed": "Pro renewed",
  "billing.credits_added": "Credits bought",
  "billing.amount_mismatch": "Payment amount mismatch",
};

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[userId]">) {
  const { userId } = await params;
  const staff = await requireStaff("view", `/admin/users/${userId}`);
  if (!z.uuid().safeParse(userId).success) notFound();
  const user = await userDetail(userId);
  if (!user) notFound();
  const { profile } = user;

  const actor = { id: staff.id, role: staff.profile.role, status: staff.profile.status };
  const target = { id: profile.id, role: profile.role, status: profile.status };
  const check = (action: UserAction) => userActionProblem(actor, target, action) === null;
  const allowed: Partial<Record<ActionKey, boolean>> = {
    suspend: check({ type: "suspend" }),
    reactivate: check({ type: "reactivate" }),
    terminate: check({ type: "terminate" }),
    delete: check({ type: "delete" }),
    change_role: ROLES.some((r) => check({ type: "change_role", role: r.value })),
  };
  const isSelf = staff.id === profile.id;

  return (
    <>
      <Link href="/admin/users" className="text-muted-foreground hover:text-foreground text-sm">
        ← All users
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        <div className="bg-muted text-muted-foreground flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed link
            <img src={user.avatarUrl} alt="Profile picture" className="size-full object-cover" />
          ) : (
            <UserIcon aria-hidden="true" className="size-7" />
          )}
        </div>
        <div className="min-w-0">
          <PageTitle title={profile.full_name || user.email || "Unnamed user"} description={user.email} />
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
            <span className="bg-muted rounded-full px-2.5 py-0.5">{roleLabel(profile.role)}</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5",
                profile.status === "active" ? "bg-accent text-accent-foreground" : "bg-destructive/10 text-destructive",
              )}
            >
              {STATUS_LABELS[profile.status]}
            </span>
            <span className="bg-muted rounded-full px-2.5 py-0.5">{profile.plan === "pro" ? "Pro" : "Free"}</span>
          </div>
        </div>
      </div>

      {profile.status !== "active" ? (
        <p className="border-destructive/40 rounded-xl border p-4 text-sm">
          {STATUS_LABELS[profile.status]}
          {profile.status_changed_at ? ` on ${dateTime.format(new Date(profile.status_changed_at))}` : ""}.
          {profile.status_reason ? ` Reason: ${profile.status_reason}` : " No reason given."}
        </p>
      ) : null}

      <StatGrid>
        <Stat label="Joined" value={adminDate.format(new Date(profile.created_at))} />
        <Stat label="Last sign-in" value={user.lastSignIn ? adminDate.format(new Date(user.lastSignIn)) : "Never"} />
        <Stat label="Credits" value={num(profile.credits)} />
        <Stat label="Paid in total" value={formatMoney(koboToNaira(user.counts.paidKobo))} />
        <Stat label="Documents" value={num(user.counts.documents)} />
        <Stat label="Assessments" value={num(user.counts.assessments)} />
        <Stat label="Simulations" value={num(user.counts.simulations)} />
        <Stat label="Country" value={profile.country ?? "–"} />
      </StatGrid>

      <section className="grid gap-3" aria-labelledby="startup-h">
        <h2 id="startup-h" className="font-semibold">Startup</h2>
        {user.startup ? (
          <div className="bg-card flex items-center gap-4 rounded-xl border p-4">
            <div className="text-muted-foreground flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white">
              {user.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed link
                <img src={user.logoUrl} alt="Company logo" className="size-full object-contain p-1" />
              ) : (
                <ImageIcon aria-hidden="true" className="size-6" />
              )}
            </div>
            <div>
              <p className="font-medium">{user.startup.name}</p>
              <p className="text-muted-foreground text-sm">
                {[labelFor(STAGE_OPTIONS, user.startup.stage), user.startup.industry, user.startup.country].filter(Boolean).join(" · ") || "No details yet"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No startup yet (onboarding not finished).</p>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="actions-h">
        <h2 id="actions-h" className="font-semibold">Manage account</h2>
        {isSelf ? (
          <p className="text-muted-foreground text-sm">This is your own account. Another admin has to make changes to it.</p>
        ) : Object.values(allowed).some(Boolean) ? (
          <UserActions userId={profile.id} allowed={allowed} roles={ROLES} currentRole={profile.role} />
        ) : (
          <p className="text-muted-foreground text-sm">
            Your role ({roleLabel(staff.profile.role)}) can&apos;t change this account
            {profile.status === "terminated" ? ", and it has been terminated" : ""}.
          </p>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="history-h">
        <h2 id="history-h" className="font-semibold">History</h2>
        {user.history.length ? (
          <ul className="divide-y rounded-xl border text-sm">
            {user.history.map((h, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                <span>
                  {HISTORY_LABELS[h.action] ?? h.action}
                  {h.action === "profile.role_changed" && h.metadata && typeof h.metadata === "object" && "role" in h.metadata
                    ? ` to ${roleLabel(String(h.metadata.role))}`
                    : ""}
                  <span className="text-muted-foreground"> · by {h.actor}</span>
                </span>
                <span className="text-muted-foreground">{dateTime.format(new Date(h.created_at))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No account changes recorded.</p>
        )}
      </section>
    </>
  );
}
