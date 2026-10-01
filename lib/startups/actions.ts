"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { formValues, validationFailed, type FormState } from "@/lib/forms";
import { onboardingSchema, startupSchema } from "@/lib/startups/schema";
import { completeOnboarding, saveMyStartup } from "@/lib/startups/service";

const NOT_SIGNED_IN: FormState = {
  status: "error",
  message: "Your session has ended. Please log in again.",
};

const SAVE_FAILED = "We couldn't save your changes. Please try again.";

export async function submitOnboarding(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;

  const values = formValues(formData);
  const parsed = onboardingSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);

  try {
    await completeOnboarding(user.id, parsed.data);
  } catch (error) {
    console.error(error);
    return { status: "error", message: SAVE_FAILED, values };
  }

  revalidatePath("/app", "layout");
  redirect("/app");
}

export async function updateStartup(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;

  const values = formValues(formData);
  const parsed = startupSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);

  try {
    await saveMyStartup(user.id, parsed.data);
  } catch (error) {
    console.error(error);
    return { status: "error", message: SAVE_FAILED, values };
  }

  revalidatePath("/app", "layout");
  return { status: "success", message: "Startup profile saved.", values };
}
