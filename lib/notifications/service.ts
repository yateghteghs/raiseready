import type { Staff } from "@/lib/admin/auth";
import type { NotificationInput } from "@/lib/notifications/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** A send problem staff can fix; the message is shown to them. */
export class NotificationError extends Error {}

export type InboxItem = { id: string; title: string; body: string; link: string | null; created_at: string; read: boolean };

/**
 * The founder's messages: ones sent to them, plus messages to everyone sent
 * since they joined. Read through RLS, so nobody sees anyone else's.
 */
export async function inbox(userId: string, joinedAt: string, limit = 50): Promise<InboxItem[]> {
  const supabase = await createClient();
  const [messages, reads] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, user_id, title, body, link, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("notification_reads").select("notification_id").eq("user_id", userId),
  ]);
  if (messages.error) throw new Error(`Could not load notifications: ${messages.error.message}`);
  const read = new Set((reads.data ?? []).map((r) => r.notification_id));
  return (messages.data ?? [])
    .filter((m) => m.user_id !== null || m.created_at >= joinedAt)
    .map((m) => ({ id: m.id, title: m.title, body: m.body, link: m.link, created_at: m.created_at, read: read.has(m.id) }));
}

export async function unreadCount(userId: string, joinedAt: string): Promise<number> {
  try {
    return (await inbox(userId, joinedAt)).filter((m) => !m.read).length;
  } catch (error) {
    // The badge is a nicety; never break the page over it.
    console.error(error);
    return 0;
  }
}

/** Marks the given messages read for this founder. Server-written, scoped to the user. */
export async function markRead(userId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await createAdminClient()
    .from("notification_reads")
    .upsert(ids.map((id) => ({ notification_id: id, user_id: userId })), { onConflict: "notification_id,user_id", ignoreDuplicates: true });
  if (error) console.error(`Could not mark notifications read: ${error.message}`);
}

/** Sends a message to one founder (by email) or to everyone, and logs who sent it. */
export async function sendNotification(staff: Staff, input: NotificationInput): Promise<{ recipient: string }> {
  const admin = createAdminClient();
  let userId: string | null = null;
  if (input.audience === "one") {
    userId = await userIdForEmail(input.email!);
    if (!userId) throw new NotificationError("No account uses that email address.");
  }
  const { data, error } = await admin
    .from("notifications")
    .insert({ user_id: userId, title: input.title, body: input.body, link: input.link ?? null, created_by: staff.id })
    .select("id")
    .single();
  if (error) throw new Error(`Could not send notification: ${error.message}`);
  await admin.from("audit_logs").insert({
    actor_id: staff.id,
    action: "admin.notification_sent",
    target_type: "notification",
    target_id: data.id,
    metadata: { audience: input.audience, user_id: userId },
  });
  return { recipient: userId ? input.email! : "everyone" };
}

/** The account id for an email address, or null if nobody has signed up with it. */
export async function userIdForEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const wanted = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not look up user: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === wanted);
    if (match) return match.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

/** Recently sent messages for the admin page. */
export async function recentlySent(limit = 30) {
  const { data, error } = await createAdminClient()
    .from("notifications")
    .select("id, user_id, title, body, link, created_by, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load notifications: ${error.message}`);
  return data ?? [];
}

/** Deletes a sent message (e.g. one sent by mistake). */
export async function deleteNotification(staff: Staff, id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").delete().eq("id", id);
  if (error) throw new Error(`Could not delete notification: ${error.message}`);
  await admin.from("audit_logs").insert({ actor_id: staff.id, action: "admin.notification_deleted", target_type: "notification", target_id: id, metadata: {} });
}
