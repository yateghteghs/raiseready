import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import type { Staff } from "@/lib/admin/auth";
import { emailsById } from "@/lib/admin/data";
import { userIdForEmail } from "@/lib/notifications/service";
import { bandFor } from "@/lib/scoring/rubric";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/lib/supabase/database.types";

/**
 * Teams for accelerators and hubs (sold directly, not through checkout).
 * Super admins create a team with a number of seats and an end date, and
 * share its join link. Founders who join get Pro Plus until the team ends.
 * The team's owner sees a summary of each member's progress.
 */

/** A problem the person can act on; the message is safe to show. */
export class TeamError extends Error {}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function isJoinToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32}$/.test(value);
}

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const teamSchema = z.object({
  name: z.string().trim().min(1, { error: "Give the team a name." }).max(100),
  seats: z.coerce.number({ error: "Enter the number of seats." }).int().min(1, { error: "At least 1 seat." }).max(1000),
  ends_on: z.iso.date({ error: "Pick the last day of the agreement." }),
  owner_email: z.preprocess(blank, z.email({ error: "Enter a valid email, or leave it empty." }).optional()),
  notes: z.preprocess(blank, z.string().trim().max(1000).optional()),
});
export type TeamInput = z.infer<typeof teamSchema>;

/** The end of the chosen day in Lagos (UTC+1). */
export function endOfLagosDay(isoDate: string): string {
  return new Date(`${isoDate}T23:59:59+01:00`).toISOString();
}

export const isActive = (team: Pick<Tables<"teams">, "ends_at">, now = Date.now()) => new Date(team.ends_at).getTime() > now;

async function audit(staff: Staff | null, action: string, teamId: string, metadata: Record<string, unknown> = {}) {
  await createAdminClient()
    .from("audit_logs")
    .insert({ actor_id: staff?.id ?? null, action, target_type: "team", target_id: teamId, metadata: metadata as Json });
}

async function ownerId(email: string | undefined): Promise<string | null> {
  if (!email) return null;
  const id = await userIdForEmail(email);
  if (!id) throw new TeamError("No RaiseReady account uses that email. Ask the team's contact to sign up first, then try again.");
  return id;
}

async function memberCount(teamId: string): Promise<number> {
  const { count } = await createAdminClient().from("team_members").select("user_id", { count: "exact", head: true }).eq("team_id", teamId);
  return count ?? 0;
}

// ---------------------------------------------------------------- admin side

export async function createTeam(staff: Staff, input: TeamInput): Promise<string> {
  const { data, error } = await createAdminClient()
    .from("teams")
    .insert({
      name: input.name,
      seats: input.seats,
      ends_at: endOfLagosDay(input.ends_on),
      owner_id: await ownerId(input.owner_email),
      notes: input.notes ?? null,
      created_by: staff.id,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not create team: ${error?.message}`);
  await audit(staff, "admin.team_created", data.id, { seats: input.seats, ends_on: input.ends_on });
  return data.id;
}

export async function updateTeam(staff: Staff, teamId: string, input: TeamInput): Promise<void> {
  const members = await memberCount(teamId);
  if (input.seats < members) throw new TeamError(`The team already has ${members} members. Remove some before lowering the seats.`);
  const { error } = await createAdminClient()
    .from("teams")
    .update({
      name: input.name,
      seats: input.seats,
      ends_at: endOfLagosDay(input.ends_on),
      owner_id: await ownerId(input.owner_email),
      notes: input.notes ?? null,
    })
    .eq("id", teamId);
  if (error) throw new Error(`Could not update team: ${error.message}`);
  await audit(staff, "admin.team_updated", teamId, { seats: input.seats, ends_on: input.ends_on });
}

/** A new join link. Any earlier link stops working. Returns the token, shown once. */
export async function newJoinLink(staff: Staff, teamId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const { error } = await createAdminClient().from("teams").update({ join_token_hash: hashToken(token) }).eq("id", teamId);
  if (error) throw new Error(`Could not create join link: ${error.message}`);
  await audit(staff, "admin.team_link_created", teamId);
  return token;
}

export async function turnOffJoinLink(staff: Staff, teamId: string): Promise<void> {
  await createAdminClient().from("teams").update({ join_token_hash: null }).eq("id", teamId);
  await audit(staff, "admin.team_link_turned_off", teamId);
}

export async function removeMember(staff: Staff, teamId: string, userId: string): Promise<void> {
  await createAdminClient().from("team_members").delete().eq("team_id", teamId).eq("user_id", userId);
  await audit(staff, "admin.team_member_removed", teamId, { user_id: userId });
}

export type TeamSummary = Tables<"teams"> & { members: number; active: boolean };

export async function listTeams(): Promise<TeamSummary[]> {
  const admin = createAdminClient();
  const [{ data: teams, error }, { data: members }] = await Promise.all([
    admin.from("teams").select("*").order("created_at", { ascending: false }),
    admin.from("team_members").select("team_id"),
  ]);
  if (error) throw new Error(`Could not load teams: ${error.message}`);
  const counts = new Map<string, number>();
  for (const m of members ?? []) counts.set(m.team_id, (counts.get(m.team_id) ?? 0) + 1);
  return (teams ?? []).map((t) => ({ ...t, members: counts.get(t.id) ?? 0, active: isActive(t) }));
}

export type CohortRow = {
  userId: string;
  name: string;
  email: string | null;
  startup: string | null;
  score: number | null;
  band: string | null;
  simulations: number;
  lastSeen: string | null;
  joinedAt: string;
};

/**
 * Each member's progress: readiness score, completed practice meetings and
 * when they were last active. Never their documents, answers or reports.
 */
export async function cohort(teamId: string, withEmails = false): Promise<CohortRow[]> {
  const admin = createAdminClient();
  const { data: members } = await admin.from("team_members").select("user_id, joined_at").eq("team_id", teamId);
  const ids = (members ?? []).map((m) => m.user_id);
  if (!ids.length) return [];
  const [{ data: profiles }, { data: startups }, emails] = await Promise.all([
    admin.from("profiles").select("id, full_name, last_seen_at").in("id", ids),
    admin.from("startups").select("id, owner_id, name").in("owner_id", ids),
    withEmails ? emailsById() : Promise.resolve(new Map<string, string>()),
  ]);
  const startupIds = (startups ?? []).map((s) => s.id);
  const [{ data: assessments }, { data: sims }] = startupIds.length
    ? await Promise.all([
        admin.from("assessments").select("startup_id, overall_score, created_at").in("startup_id", startupIds).order("created_at", { ascending: false }),
        admin.from("simulations").select("startup_id").in("startup_id", startupIds).eq("status", "completed").eq("mode", "full"),
      ])
    : [{ data: [] }, { data: [] }];

  return (members ?? [])
    .map((m) => {
      const profile = (profiles ?? []).find((p) => p.id === m.user_id);
      const startup = (startups ?? []).find((s) => s.owner_id === m.user_id);
      const latest = startup ? (assessments ?? []).find((a) => a.startup_id === startup.id) : undefined;
      return {
        userId: m.user_id,
        name: profile?.full_name || "Unnamed founder",
        email: withEmails ? (emails.get(m.user_id) ?? null) : null,
        startup: startup?.name ?? null,
        score: latest?.overall_score ?? null,
        band: latest ? bandFor(latest.overall_score).label : null,
        simulations: startup ? (sims ?? []).filter((s) => s.startup_id === startup.id).length : 0,
        lastSeen: profile?.last_seen_at ?? null,
        joinedAt: m.joined_at,
      };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

// -------------------------------------------------------------- founder side

export type JoinableTeam = { id: string; name: string; endsAt: string; full: boolean; ended: boolean };

/** The team a join link belongs to, or null if the link is wrong or turned off. */
export async function teamForJoinToken(token: string): Promise<JoinableTeam | null> {
  if (!isJoinToken(token)) return null;
  const { data: team } = await createAdminClient().from("teams").select("*").eq("join_token_hash", hashToken(token)).maybeSingle();
  if (!team) return null;
  return { id: team.id, name: team.name, endsAt: team.ends_at, full: (await memberCount(team.id)) >= team.seats, ended: !isActive(team) };
}

export async function joinTeam(userId: string, token: string): Promise<{ name: string }> {
  const team = await teamForJoinToken(token);
  if (!team) throw new TeamError("This join link isn't valid any more. Ask your programme for a new one.");
  if (team.ended) throw new TeamError(`${team.name}'s RaiseReady access has ended.`);
  const admin = createAdminClient();
  const { data: current } = await admin.from("team_members").select("team_id").eq("user_id", userId).maybeSingle();
  if (current?.team_id === team.id) return { name: team.name };
  if (current) throw new TeamError("You're already in another team. Leave it under Settings first.");
  if (team.full) throw new TeamError(`${team.name} has no seats left. Ask your programme to add more.`);
  const { error } = await admin.from("team_members").insert({ team_id: team.id, user_id: userId });
  if (error) throw new TeamError("You couldn't be added to the team. Please try again.");
  // Seats are checked again after joining, in case several people joined at once.
  const { data: row } = await admin.from("teams").select("seats").eq("id", team.id).single();
  if (row && (await memberCount(team.id)) > row.seats) {
    await admin.from("team_members").delete().eq("team_id", team.id).eq("user_id", userId);
    throw new TeamError(`${team.name} has no seats left. Ask your programme to add more.`);
  }
  await audit(null, "team.joined", team.id, { user_id: userId });
  return { name: team.name };
}

export async function leaveTeam(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: current } = await admin.from("team_members").select("team_id").eq("user_id", userId).maybeSingle();
  if (!current) return;
  await admin.from("team_members").delete().eq("user_id", userId);
  await audit(null, "team.left", current.team_id, { user_id: userId });
}

/** The team this founder runs (sees the cohort of), if any. */
export async function ownedTeam(userId: string): Promise<Tables<"teams"> | null> {
  const { data } = await createAdminClient()
    .from("teams")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// ---------------------------------------------------------------- enquiries

export const enquirySchema = z.object({
  name: z.string().trim().min(1, { error: "Enter your name." }).max(100),
  organisation: z.string().trim().min(1, { error: "Enter your organisation." }).max(150),
  email: z.email({ error: "Enter a valid email address." }).max(254),
  cohort_size: z.preprocess(blank, z.coerce.number({ error: "Enter a number." }).int().min(1).max(10000).optional()),
  message: z.preprocess(blank, z.string().trim().max(2000, { error: "Keep it under 2,000 characters." }).optional()),
});
export type EnquiryInput = z.infer<typeof enquirySchema>;

/** Stores a Teams enquiry. A few per email a day at most, to limit spam. */
export async function submitEnquiry(input: EnquiryInput): Promise<void> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin
    .from("team_enquiries")
    .select("id", { count: "exact", head: true })
    .eq("email", input.email.toLowerCase())
    .gte("created_at", since);
  if ((count ?? 0) >= 3) throw new TeamError("We've received your message. We'll be in touch soon.");
  const { error } = await admin.from("team_enquiries").insert({
    name: input.name,
    organisation: input.organisation,
    email: input.email.toLowerCase(),
    cohort_size: input.cohort_size ?? null,
    message: input.message ?? null,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not save enquiry: ${error.message}`);
}

export async function listEnquiries(limit = 50): Promise<Tables<"team_enquiries">[]> {
  const { data, error } = await createAdminClient().from("team_enquiries").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Could not load enquiries: ${error.message}`);
  return data ?? [];
}

export async function setEnquiryStatus(staff: Staff, id: string, status: Tables<"team_enquiries">["status"]): Promise<void> {
  await createAdminClient().from("team_enquiries").update({ status }).eq("id", id);
  await audit(staff, "admin.team_enquiry_updated", id, { status });
}
