"use server";

import { revalidatePath } from "next/cache";

import { AssessmentError, runAssessment } from "@/lib/assessment/service";
import { getCurrentUser } from "@/lib/auth/session";
import { PlanLimitError } from "@/lib/billing/limits";
import { getMyStartup } from "@/lib/startups/service";

export type RunAssessmentResult = { ok: true; reused: boolean } | { ok: false; error: string; upgrade?: boolean };

export async function runAssessmentAction(): Promise<RunAssessmentResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Your session has ended. Please log in again." };
    const startup = await getMyStartup();
    if (!startup) return { ok: false, error: "Set up your startup profile first." };

    const { reused } = await runAssessment(user.id, startup);
    revalidatePath("/app", "layout");
    return { ok: true, reused };
  } catch (error) {
    if (error instanceof PlanLimitError) return { ok: false, error: error.message, upgrade: true };
    if (error instanceof AssessmentError) return { ok: false, error: error.message };
    console.error("[assessment] run failed:", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
