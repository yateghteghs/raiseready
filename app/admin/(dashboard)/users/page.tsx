import { planLabel } from "@/lib/admin/labels";
import Link from "next/link";

import { ExportButton } from "@/components/admin/export-button";
import { StaffInviteForm, StaffLinkButton } from "@/components/admin/staff-invite";
import { Pager, pageParam } from "@/components/admin/pager";
import { adminDate, PageTitle, Table } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireStaff } from "@/lib/admin/auth";
import { PAGE_SIZE, usersList } from "@/lib/admin/data";
import { can, roleLabel, ROLES, STATUS_LABELS } from "@/lib/admin/permissions";
import { staffInviteProblem, STAFF_ROLES } from "@/lib/admin/staff";
import { cn } from "@/lib/utils";

export const metadata = { title: "Users" };

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  const staff = await requireStaff("view", "/admin/users");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const page = pageParam(params.page);
  const tab = params.tab === "staff" ? "staff" : "founders";
  const { rows: users, total } = await usersList({ page }, q, tab);
  const role = staff.profile.role;
  const invitable = STAFF_ROLES.filter((r) => !staffInviteProblem(role, r)).map((r) => ({ value: r, label: roleLabel(r) }));
  const canLink = role === "super_admin";
  const status = (u: (typeof users)[number]) => (
    <span className={cn(u.status !== "active" && "text-destructive font-medium")}>{STATUS_LABELS[u.status]}</span>
  );
  const email = (u: (typeof users)[number]) => (
    <Link href={`/admin/users/${u.id}`} className="font-medium underline-offset-4 hover:underline">
      {u.email || "unknown"}
    </Link>
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          title="Users"
          description="Founders use the app; staff work in the admin area. Newest first. Open someone to see their activity and manage their account."
        />
        {can(staff.profile.role, "export") ? <ExportButton kind="users" /> : null}
      </div>
      {params.deleted === "1" ? (
        <p role="status" className="border-primary/30 bg-accent rounded-xl border p-4 text-sm">
          The account and its data have been deleted.
        </p>
      ) : null}
      <nav aria-label="User type" className="-mt-2 flex gap-2">
        {(
          [
            ["founders", "Founders"],
            ["staff", "Staff"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={value === "staff" ? "/admin/users?tab=staff" : "/admin/users"}
            aria-current={tab === value ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-sm", tab === value ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "staff" && invitable.length ? <StaffInviteForm roles={invitable} /> : null}
      <form role="search" className="flex max-w-md gap-2">
        {tab === "staff" ? <input type="hidden" name="tab" value="staff" /> : null}
        <label htmlFor="q" className="sr-only">
          Search users
        </label>
        <Input id="q" name="q" type="search" defaultValue={q} placeholder="Search by email, name or startup" />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      {tab === "founders" ? (
        <Table
          caption="Founders"
          rows={users}
          empty={q ? "No founders match that search." : "No founders yet."}
          columns={[
            { header: "Email", cell: email },
            { header: "Name", cell: (u) => u.full_name ?? "" },
            { header: "Startup", cell: (u) => u.startup?.name ?? <span className="text-muted-foreground">none</span> },
            { header: "Status", cell: status },
            { header: "Plan", cell: (u) => planLabel(u.plan) },
            { header: "Credits", cell: (u) => u.credits, align: "right" },
            { header: "Onboarded", cell: (u) => (u.onboarding_complete ? "Yes" : "No") },
            { header: "Country", cell: (u) => u.country ?? "" },
            { header: "Joined", cell: (u) => adminDate.format(new Date(u.created_at)) },
          ]}
        />
      ) : (
        <Table
          caption="Staff"
          rows={users}
          empty={q ? "No staff match that search." : "No staff yet."}
          columns={[
            { header: "Email", cell: email },
            { header: "Name", cell: (u) => u.full_name ?? "" },
            {
              header: "Role",
              cell: (u) => (
                <span title={ROLES.find((r) => r.value === u.role)?.summary}>{roleLabel(u.role)}</span>
              ),
            },
            { header: "Status", cell: status },
            { header: "Last seen", cell: (u) => (u.last_seen_at ? adminDate.format(new Date(u.last_seen_at)) : <span className="text-muted-foreground">never</span>) },
            { header: "Added", cell: (u) => adminDate.format(new Date(u.created_at)) },
            ...(canLink
              ? [{ header: "Sign-in", cell: (u: (typeof users)[number]) => (u.id === staff.id ? null : <StaffLinkButton userId={u.id} />) }]
              : []),
          ]}
        />
      )}
      <Pager page={page} total={total} pageSize={PAGE_SIZE} path="/admin/users" params={{ ...(q ? { q } : {}), ...(tab === "staff" ? { tab } : {}) }} />
    </>
  );
}
