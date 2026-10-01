"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { PlanLimitError } from "@/lib/billing/limits";
import type { FormState } from "@/lib/forms";
import { createReport, ReportError, reportDownloadLink } from "@/lib/reports/service";
import { getMyStartup } from "@/lib/startups/service";

const createSchema = z.object({ simulation_id: z.union([z.uuid(), z.literal("")]).optional() });

export async function createReportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Choose a practice session or none." };

  let id: string;
  try {
    const user = await getCurrentUser();
    if (!user) return { status: "error", message: "Your session has ended. Please log in again." };
    const startup = await getMyStartup();
    if (!startup) return { status: "error", message: "Set up your startup profile first." };
    id = await createReport(user.id, startup, parsed.data.simulation_id || null);
  } catch (error) {
    if (error instanceof ReportError) return { status: "error", message: error.message };
    console.error("[reports] create failed:", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
  redirect(`/app/reports/${id}`);
}

export async function reportDownloadAction(
  reportId: string,
): Promise<{ url: string } | { error: string; upgrade?: boolean }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { error: "Your session has ended. Please log in again." };
    return { url: await reportDownloadLink(user.id, String(reportId)) };
  } catch (error) {
    if (error instanceof PlanLimitError) return { error: error.message, upgrade: true };
    if (error instanceof ReportError) return { error: error.message };
    console.error("[reports] download failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}
