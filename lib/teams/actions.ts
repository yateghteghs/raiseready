"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getStaff } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { formValues, validationFailed, type FormState } from "@/lib/forms";
import { getSiteUrl } from "@/lib/site-url";
import {
  createTeam,
  enquirySchema,
  isJoinToken,
  joinTeam,
  leaveTeam,
  newJoinLink,
  removeMember,
  setEnquiryStatus,
  submitEnquiry,
  TeamError,
  teamSchema,
  turnOffJoinLink,
  updateTeam,
} from "@/lib/teams/service";

async function teamManager() {
  const staff = await getStaff();
  return staff && can(staff.profile.role, "manage_teams") ? staff : null;
}
const isId = (v: unknown) => z.uuid().safeParse(v).success;
const NOT_ALLOWED = { status: "error", message: "Only a super admin can manage teams." } as const;

// ---------------------------------------------------------------- admin

export async function saveTeamAction(teamId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await teamManager();
  if (!staff) return NOT_ALLOWED;
  if (teamId && !isId(teamId)) return { status: "error", message: "Unknown team." };
  const values = formValues(formData);
  const parsed = teamSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  let id = teamId;
  try {
    if (teamId) await updateTeam(staff, teamId, parsed.data);
    else id = await createTeam(staff, parsed.data);
  } catch (error) {
    if (error instanceof TeamError) return { status: "error", message: error.message, values };
    console.error("[teams] save failed:", error);
    return { status: "error", message: "Something went wrong. Nothing was saved.", values };
  }
  revalidatePath("/admin/teams");
  if (!teamId) redirect(`/admin/teams/${id}`);
  revalidatePath(`/admin/teams/${teamId}`);
  return { status: "success", message: "Saved." };
}

export async function newJoinLinkAction(teamId: string): Promise<{ url?: string; error?: string }> {
  const staff = await teamManager();
  if (!staff || !isId(teamId)) return { error: "Not allowed." };
  const token = await newJoinLink(staff, teamId);
  revalidatePath(`/admin/teams/${teamId}`);
  return { url: `${await getSiteUrl()}/join/${token}` };
}

export async function turnOffJoinLinkAction(teamId: string): Promise<void> {
  const staff = await teamManager();
  if (!staff || !isId(teamId)) return;
  await turnOffJoinLink(staff, teamId);
  revalidatePath(`/admin/teams/${teamId}`);
}

export async function removeMemberAction(teamId: string, userId: string): Promise<void> {
  const staff = await teamManager();
  if (!staff || !isId(teamId) || !isId(userId)) return;
  await removeMember(staff, teamId, userId);
  revalidatePath(`/admin/teams/${teamId}`);
}

export async function setEnquiryStatusAction(id: string, status: string): Promise<void> {
  const staff = await teamManager();
  const parsed = z.enum(["new", "contacted", "closed"]).safeParse(status);
  if (!staff || !isId(id) || !parsed.success) return;
  await setEnquiryStatus(staff, id, parsed.data);
  revalidatePath("/admin/teams");
}

// -------------------------------------------------------------- founders

export async function joinTeamAction(token: string): Promise<FormState> {
  if (!isJoinToken(token)) return { status: "error", message: "This join link isn't valid." };
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Log in first, then open the link again." };
  let name: string;
  try {
    ({ name } = await joinTeam(user.id, token));
  } catch (error) {
    if (error instanceof TeamError) return { status: "error", message: error.message };
    console.error("[teams] join failed:", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
  redirect(`/app?joined=${encodeURIComponent(name)}`);
}

export async function leaveTeamAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await leaveTeam(user.id);
  revalidatePath("/app", "layout");
}

// -------------------------------------------------------------- public

export async function enquiryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  // Bots tend to fill every field, including this hidden one.
  if (String(formData.get("website") ?? "")) return { status: "success", message: "Thanks. We'll be in touch soon." };
  const values = formValues(formData);
  delete values.website;
  const parsed = enquirySchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  try {
    await submitEnquiry(parsed.data);
  } catch (error) {
    if (error instanceof TeamError) return { status: "success", message: error.message };
    console.error("[teams] enquiry failed:", error);
    return { status: "error", message: "Something went wrong. Please try again.", values };
  }
  return { status: "success", message: "Thanks. We'll be in touch within two working days." };
}
