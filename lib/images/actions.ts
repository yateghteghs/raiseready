"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import type { ImageKind } from "@/lib/images/rules";
import { ImageError, removeImage, saveImage } from "@/lib/images/service";
import { getMyStartup } from "@/lib/startups/service";

const LABEL: Record<ImageKind, string> = { avatar: "Profile picture", logo: "Company logo" };

async function run(kind: ImageKind, fn: (userId: string, startupId?: string) => Promise<void>, done: string): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Your session has ended. Please log in again." };
  try {
    const startup = kind === "logo" ? await getMyStartup() : null;
    await fn(user.id, startup?.id);
  } catch (error) {
    if (error instanceof ImageError) return { status: "error", message: error.message };
    console.error(`[images] ${kind} failed:`, error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
  revalidatePath("/app", "layout");
  return { status: "success", message: `${LABEL[kind]} ${done}.` };
}

/** Uploads the founder's profile picture or company logo (the `kind` is bound by the form). */
export async function uploadImageAction(kind: ImageKind, _prev: FormState, formData: FormData): Promise<FormState> {
  if (kind !== "avatar" && kind !== "logo") return { status: "error", message: "Unknown image." };
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose an image first." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  return run(kind, (userId, startupId) => saveImage(userId, kind, bytes, startupId), "saved");
}

export async function removeImageAction(kind: ImageKind): Promise<FormState> {
  if (kind !== "avatar" && kind !== "logo") return { status: "error", message: "Unknown image." };
  return run(kind, (userId, startupId) => removeImage(userId, kind, startupId), "removed");
}
