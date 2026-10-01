import { createClient } from "@/lib/supabase/server";

export type ActivityItem = { at: string; text: string; href: string };

/** Recent things that happened on the founder's startup, newest first. Runs as the user. */
export async function recentActivity(startupId: string, limit = 6): Promise<ActivityItem[]> {
  const supabase = await createClient();
  const [docs, profiles, assessments] = await Promise.all([
    supabase.from("documents").select("created_at, original_filename").eq("startup_id", startupId).order("created_at", { ascending: false }).limit(limit),
    supabase.from("knowledge_profiles").select("created_at, version").eq("startup_id", startupId).order("created_at", { ascending: false }).limit(limit),
    supabase.from("assessments").select("created_at, overall_score").eq("startup_id", startupId).order("created_at", { ascending: false }).limit(limit),
  ]);
  for (const r of [docs, profiles, assessments]) {
    if (r.error) throw new Error(`Could not load activity: ${r.error.message}`);
  }
  const items: ActivityItem[] = [
    ...(docs.data ?? []).map((d) => ({ at: d.created_at, text: `Uploaded ${d.original_filename ?? "a document"}`, href: "/app/documents" })),
    ...(profiles.data ?? []).map((p) => ({ at: p.created_at, text: `Documents analysed (version ${p.version})`, href: "/app/documents" })),
    ...(assessments.data ?? []).map((a) => ({ at: a.created_at, text: `Readiness assessed: ${a.overall_score}`, href: "/app/assessment" })),
  ];
  return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}
