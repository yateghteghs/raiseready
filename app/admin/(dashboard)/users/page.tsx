import { planLabel } from "@/lib/admin/labels";
import Link from "next/link";

import { ExportButton } from "@/components/admin/export-button";
import { Pager, pageParam } from "@/components/admin/pager";
import { adminDate, PageTitle, Table } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireStaff } from "@/lib/admin/auth";
import { PAGE_SIZE, usersList } from "@/lib/admin/data";
import { can, roleLabel, STATUS_LABELS } from "@/lib/admin/permissions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Users" };

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  const staff = await requireStaff("view", "/admin/users");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const page = pageParam(params.page);
  const { rows: users, total } = await usersList({ page }, q);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title="Users" description="Newest first. Open a user to see their activity and manage their account." />
        {can(staff.profile.role, "export") ? <ExportButton kind="users" /> : null}
      </div>
      {params.deleted === "1" ? (
        <p role="status" className="border-primary/30 bg-accent rounded-xl border p-4 text-sm">
          The account and its data have been deleted.
        </p>
      ) : null}
      <form role="search" className="flex max-w-md gap-2">
        <label htmlFor="q" className="sr-only">
          Search users
        </label>
        <Input id="q" name="q" type="search" defaultValue={q} placeholder="Search by email, name or startup" />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      <Table
        caption="Users"
        rows={users}
        empty={q ? "No users match that search." : "No users yet."}
        columns={[
          {
            header: "Email",
            cell: (u) => (
              <Link href={`/admin/users/${u.id}`} className="font-medium underline-offset-4 hover:underline">
                {u.email || "unknown"}
              </Link>
            ),
          },
          { header: "Name", cell: (u) => u.full_name ?? "" },
          { header: "Startup", cell: (u) => u.startup?.name ?? <span className="text-muted-foreground">none</span> },
          {
            header: "Status",
            cell: (u) => (
              <span className={cn(u.status !== "active" && "text-destructive font-medium")}>{STATUS_LABELS[u.status]}</span>
            ),
          },
          { header: "Role", cell: (u) => roleLabel(u.role) },
          { header: "Plan", cell: (u) => planLabel(u.plan) },
          { header: "Credits", cell: (u) => u.credits, align: "right" },
          { header: "Onboarded", cell: (u) => (u.onboarding_complete ? "Yes" : "No") },
          { header: "Country", cell: (u) => u.country ?? "" },
          { header: "Joined", cell: (u) => adminDate.format(new Date(u.created_at)) },
        ]}
      />
      <Pager page={page} total={total} pageSize={PAGE_SIZE} path="/admin/users" params={q ? { q } : {}} />
    </>
  );
}
