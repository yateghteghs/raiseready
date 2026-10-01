"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import {
  abandonSimulation,
  finalizeSimulation,
  getOwnedSimulation,
  SimulationError,
  startSimulation,
} from "@/lib/simulation/service";
import { getMyStartup } from "@/lib/startups/service";

const startSchema = z.object({
  persona: z.enum(["seed_vc", "angel", "grant_evaluator"], { error: "Choose an investor." }),
  difficulty: z.enum(["friendly", "analytical", "tough"], { error: "Choose a difficulty." }),
  funding_type: z.string().max(40).optional(),
});

export async function startSimulationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = startSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check your choices." };

  let id: string;
  try {
    const user = await getCurrentUser();
    if (!user) return { status: "error", message: "Your session has ended. Please log in again." };
    const startup = await getMyStartup();
    if (!startup) return { status: "error", message: "Set up your startup profile first." };
    id = await startSimulation(user.id, startup, {
      persona: parsed.data.persona,
      difficulty: parsed.data.difficulty,
      fundingType: parsed.data.funding_type || null,
    });
  } catch (error) {
    if (error instanceof SimulationError) return { status: "error", message: error.message };
    console.error("[simulation] start failed:", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
  redirect(`/app/investor-room/${id}`);
}

export async function abandonSimulationAction(simulationId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  try {
    await abandonSimulation(user.id, String(simulationId));
  } catch (error) {
    if (!(error instanceof SimulationError)) throw error;
  }
  revalidatePath("/app/investor-room");
  redirect("/app/investor-room");
}

/** Re-runs the end-of-meeting evaluation if it failed the first time. */
export async function retryFeedbackAction(simulationId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  try {
    const { sim } = await getOwnedSimulation(user.id, String(simulationId));
    if (sim.status !== "active" || !sim.ended_at) return { ok: false };
  } catch {
    return { ok: false };
  }
  after(() => finalizeSimulation(user.id, String(simulationId)));
  return { ok: true };
}
