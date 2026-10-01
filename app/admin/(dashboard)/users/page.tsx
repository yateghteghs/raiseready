import { adminDate, PageTitle, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { usersList } from "@/lib/admin/data";

export const metadata = { title: "Users" };

export default async function AdminUsers() {
  await requireAdmin();
  const users = await usersList();
  return (
    <>
      <PageTitle title="Users" description={`${users.length} most recent sign-ups (up to 500).`} />
      <Table
        caption="Users"
        rows={users}
        empty="No users yet."
        columns={[
          { header: "Email", cell: (u) => u.email || <span className="text-muted-foreground">unknown</span> },
          { header: "Name", cell: (u) => u.full_name ?? "" },
          { header: "Startup", cell: (u) => u.startup?.name ?? <span className="text-muted-foreground">none</span> },
          { header: "Country", cell: (u) => u.country ?? "" },
          { header: "Plan", cell: (u) => (u.plan === "pro" ? "Pro" : "Free") },
          { header: "Credits", cell: (u) => u.credits, align: "right" },
          { header: "Onboarded", cell: (u) => (u.onboarding_complete ? "Yes" : "No") },
          { header: "Role", cell: (u) => (u.role === "admin" ? "Admin" : "Founder") },
          { header: "Joined", cell: (u) => adminDate.format(new Date(u.created_at)) },
        ]}
      />
    </>
  );
}
