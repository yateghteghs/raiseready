"use server";

import { z } from "zod";

import { getStaff } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { formValues, validationFailed, type FormState } from "@/lib/forms";
import { showcaseSchema } from "@/lib/showcase/schema";
import { createShowcaseItem, deleteShowcaseItem, setShowcasePublished, ShowcaseError } from "@/lib/showcase/service";

async function contentManager() {
  const staff = await getStaff();
  return staff && can(staff.profile.role, "manage_content") ? staff : null;
}

export async function createShowcaseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await contentManager();
  if (!staff) return { status: "error", message: "Only a super admin can edit website content." };
  const values = formValues(formData);
  const parsed = showcaseSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  const file = formData.get("image");
  const image = file instanceof File && file.size > 0 ? new Uint8Array(await file.arrayBuffer()) : null;
  try {
    await createShowcaseItem(staff, parsed.data, image);
  } catch (error) {
    if (error instanceof ShowcaseError) return { status: "error", message: error.message, values };
    console.error("[showcase] create failed:", error);
    return { status: "error", message: "Something went wrong. Nothing was saved.", values };
  }
  return { status: "success", message: parsed.data.published ? "Added and published." : "Added as a draft." };
}

export async function toggleShowcaseAction(id: string, published: boolean): Promise<{ error?: string }> {
  const staff = await contentManager();
  if (!staff || !z.uuid().safeParse(id).success) return { error: "Not allowed." };
  try {
    await setShowcasePublished(staff, id, published);
    return {};
  } catch (error) {
    if (error instanceof ShowcaseError) return { error: error.message };
    console.error(error);
    return { error: "Something went wrong." };
  }
}

export async function deleteShowcaseAction(id: string): Promise<void> {
  const staff = await contentManager();
  if (!staff || !z.uuid().safeParse(id).success) return;
  await deleteShowcaseItem(staff, id);
}
