import { NotificationForm } from "@/components/admin/notification-form";
import { adminDate, PageTitle, Table } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/admin/auth";
import { emailsById } from "@/lib/admin/data";
import { deleteNotificationAction, setNotificationActiveAction } from "@/lib/notifications/actions";
import { recentlySent } from "@/lib/notifications/service";

export const metadata = { title: "Notifications" };

export default async function AdminNotifications() {
  await requireStaff("notify", "/admin/notifications");
  const [sent, emails] = await Promise.all([recentlySent(), emailsById()]);
  return (
    <>
      <PageTitle
        title="Notifications"
        description="Send a message to one founder or to everyone. It appears under the bell in their app header. Messages to everyone reach people who have already signed up. Turn a message off to hide it from founders without deleting it."
      />
      <NotificationForm />
      <section className="grid gap-3">
        <h2 className="font-semibold">Recently sent</h2>
        <Table
          caption="Recently sent notifications"
          rows={sent}
          empty="Nothing sent yet."
          columns={[
            { header: "Sent", cell: (n) => adminDate.format(new Date(n.created_at)) },
            { header: "To", cell: (n) => (n.user_id ? (emails.get(n.user_id) ?? "Deleted user") : "Everyone") },
            { header: "Title", cell: (n) => <span className="block max-w-72 truncate">{n.title}</span> },
            { header: "By", cell: (n) => (n.created_by ? (emails.get(n.created_by) ?? "Staff") : "") },
            {
              header: "Status",
              cell: (n) => (n.active ? <span className="text-primary">On</span> : <span className="text-muted-foreground">Off</span>),
            },
            {
              header: "",
              cell: (n) => (
                <div className="flex gap-1">
                  <form action={setNotificationActiveAction.bind(null, n.id, !n.active)}>
                    <Button type="submit" variant="outline" size="sm">
                      {n.active ? "Turn off" : "Turn on"}
                    </Button>
                  </form>
                  <form action={deleteNotificationAction.bind(null, n.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      Delete
                    </Button>
                  </form>
                </div>
              ),
            },
          ]}
        />
      </section>
    </>
  );
}
