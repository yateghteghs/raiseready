import { createHash, randomBytes } from "node:crypto";

import { imageLink } from "@/lib/images/service";
import { reportContentSchema, type ReportContent } from "@/lib/reports/content";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** A share problem the founder can act on; the message is shown to them. */
export class ShareError extends Error {}

export const SHARE_DAYS = [7, 30, 90] as const;
export type ShareDays = (typeof SHARE_DAYS)[number];
/** Most live links per report, so old ones get cleaned up. */
export const MAX_ACTIVE_SHARES = 5;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Links are 32 random URL-safe characters; only their hash is stored. */
export function isShareToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32}$/.test(value);
}

export type ShareRow = {
  id: string;
  expires_at: string;
  revoked_at: string | null;
  views: number;
  last_viewed_at: string | null;
  created_at: string;
  state: "live" | "expired" | "off";
};

/** The founder's links for a report, newest first. Read through RLS. */
export async function listShares(reportId: string): Promise<ShareRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_shares")
    .select("id, expires_at, revoked_at, views, last_viewed_at, created_at")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Could not load share links: ${error.message}`);
  const now = Date.now();
  return (data ?? []).map((s) => ({
    ...s,
    state: s.revoked_at ? "off" : Date.parse(s.expires_at) <= now ? "expired" : "live",
  }));
}

/**
 * Creates a read-only link to one of the founder's reports. Returns the secret
 * token, which is shown once: only its hash is kept.
 */
export async function createShare(userId: string, reportId: string, days: ShareDays): Promise<string> {
  // Ownership through RLS: founders can only read their own reports.
  const supabase = await createClient();
  const { data: report } = await supabase.from("reports").select("id").eq("id", reportId).maybeSingle();
  if (!report) throw new ShareError("Report not found.");

  const admin = createAdminClient();
  const { count } = await admin
    .from("report_shares")
    .select("id", { count: "exact", head: true })
    .eq("report_id", reportId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString());
  if ((count ?? 0) >= MAX_ACTIVE_SHARES) {
    throw new ShareError(`You already have ${MAX_ACTIVE_SHARES} live links for this report. Turn one off first.`);
  }

  const token = randomBytes(24).toString("base64url");
  const { error } = await admin.from("report_shares").insert({
    report_id: reportId,
    created_by: userId,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
  });
  if (error) throw new Error(`Could not create share link: ${error.message}`);
  return token;
}

export async function revokeShare(userId: string, shareId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("report_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId)
    .eq("created_by", userId)
    .is("revoked_at", null);
  if (error) throw new Error(`Could not turn off share link: ${error.message}`);
}

/** The report behind a live link, counting the view. Null if the link is unknown, expired or turned off. */
export async function openShare(token: string): Promise<{ content: ReportContent; logoUrl: string | null; expiresAt: string } | null> {
  if (!isShareToken(token)) return null;
  const admin = createAdminClient();
  const { data: share } = await admin
    .from("report_shares")
    .select("id, report_id, created_by, expires_at, revoked_at, views")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!share || share.revoked_at || Date.parse(share.expires_at) <= Date.now()) return null;

  const { data: report } = await admin.from("reports").select("content, startup_id").eq("id", share.report_id).maybeSingle();
  const parsed = reportContentSchema.safeParse(report?.content);
  if (!report || !parsed.success) return null;

  // A founder who has been suspended or terminated can't keep sharing.
  const { data: owner } = await admin.from("profiles").select("status").eq("id", share.created_by).maybeSingle();
  if (owner?.status !== "active") return null;

  const { data: startup } = await admin.from("startups").select("owner_id, logo_path").eq("id", report.startup_id).maybeSingle();
  await admin
    .from("report_shares")
    .update({ views: (share.views ?? 0) + 1, last_viewed_at: new Date().toISOString() })
    .eq("id", share.id);

  return {
    content: parsed.data,
    logoUrl: startup ? await imageLink(startup.owner_id, startup.logo_path) : null,
    expiresAt: share.expires_at,
  };
}
