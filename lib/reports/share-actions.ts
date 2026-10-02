"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { createShare, revokeShare, SHARE_DAYS, ShareError, type ShareDays } from "@/lib/reports/shares";
import { getSiteUrl } from "@/lib/site-url";

export async function createShareAction(reportId: string, days: number): Promise<{ url: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has ended. Please log in again." };
  if (!z.uuid().safeParse(reportId).success || !SHARE_DAYS.includes(days as ShareDays)) return { error: "Something went wrong." };
  try {
    const token = await createShare(user.id, reportId, days as ShareDays);
    revalidatePath(`/app/reports/${reportId}`);
    return { url: `${await getSiteUrl()}/shared/${token}` };
  } catch (error) {
    if (error instanceof ShareError) return { error: error.message };
    console.error("[shares] create failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function revokeShareAction(reportId: string, shareId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !z.uuid().safeParse(shareId).success) return;
  await revokeShare(user.id, shareId);
  revalidatePath(`/app/reports/${reportId}`);
}
