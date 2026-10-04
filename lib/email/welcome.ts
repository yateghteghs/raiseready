import { isStaff } from "@/lib/admin/permissions";
import { sendEmail } from "@/lib/email/mailtrap";
import { welcomeEmail } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sends the welcome email from Mhenuter once, after a founder has confirmed
 * their email. Safe to call on every confirmation and sign-in: the
 * `welcome_email_sent_at` claim is taken atomically, so it never goes twice,
 * and it's released again if Mailtrap doesn't accept the email. Best-effort:
 * never throws.
 */
export async function sendWelcomeEmail(userId: string): Promise<"sent" | "skipped" | "failed"> {
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("role, full_name, welcome_email_sent_at").eq("id", userId).maybeSingle();
    if (!profile || profile.welcome_email_sent_at || isStaff(profile.role)) return "skipped";

    const { data: auth } = await admin.auth.admin.getUserById(userId);
    const email = auth.user?.email;
    if (!email || !auth.user?.email_confirmed_at) return "skipped";

    // Claim it: only the call that flips null → now sends.
    const { data: claimed } = await admin
      .from("profiles")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", userId)
      .is("welcome_email_sent_at", null)
      .select("id");
    if (!claimed?.length) return "skipped";

    const name = profile.full_name ?? undefined;
    const sent = await sendEmail({
      to: [{ email, ...(name ? { name } : {}) }],
      ...welcomeEmail({ name, appUrl: process.env.APP_URL || (await getSiteUrl()) }),
      category: "Welcome",
      sender: "personal",
    });
    if (sent.ok) return "sent";
    await admin.from("profiles").update({ welcome_email_sent_at: null }).eq("id", userId);
    return "failed";
  } catch (error) {
    console.error(`[email] welcome email failed: ${error instanceof Error ? error.message : error}`);
    return "failed";
  }
}
