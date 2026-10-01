import Link from "next/link";

import { adminDate, PageTitle, Table } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireStaff } from "@/lib/admin/auth";
import { usersList } from "@/lib/admin/data";
import { roleLabel, STATUS_LABELS } from "@/lib/admin/permissions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Users" };

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  await requireStaff("view", "/admin/users");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase().slice(0, 100) : "";
  const all = await usersList();
  const users = q
    ? all.filter((u) => [u.email, u.full_name, u.startup?.name].some((v) => v?.toLowerCase().includes(q)))
    : all;

  return (
    <>
      <PageTitle title="Users" description="The 500 most recent sign-ups. Open a user to suspend, terminate, delete or change their role." />
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
          { header: "Plan", cell: (u) => (u.plan === "pro" ? "Pro" : "Free") },
          { header: "Credits", cell: (u) => u.credits, align: "right" },
          { header: "Onboarded", cell: (u) => (u.onboarding_complete ? "Yes" : "No") },
          { header: "Country", cell: (u) => u.country ?? "" },
          { header: "Joined", cell: (u) => adminDate.format(new Date(u.created_at)) },
        ]}
      />
    </>
  );
}
