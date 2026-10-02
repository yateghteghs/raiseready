"use server";

import { z } from "zod";

import { getStaff } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { deleteFaqItem, faqSchema, saveFaqItem, setFaqPublished } from "@/lib/faq/service";
import { formValues, validationFailed, type FormState } from "@/lib/forms";

async function editor() {
  const staff = await getStaff();
  return staff && can(staff.profile.role, "manage_content") ? staff : null;
}

/** Adds an entry, or updates one when `id` is bound. */
export async function saveFaqAction(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await editor();
  if (!staff) return { status: "error", message: "Only a super admin can edit the FAQ." };
  if (id && !z.uuid().safeParse(id).success) return { status: "error", message: "Unknown entry." };
  const values = formValues(formData);
  const parsed = faqSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  try {
    await saveFaqItem(staff, parsed.data, id ?? undefined);
  } catch (error) {
    console.error("[faq] save failed:", error);
    return { status: "error", message: "Something went wrong. Nothing was saved.", values };
  }
  return { status: "success", message: id ? "Saved." : parsed.data.published ? "Added to the FAQ." : "Saved as a draft." };
}

export async function toggleFaqAction(id: string, published: boolean): Promise<void> {
  const staff = await editor();
  if (!staff || !z.uuid().safeParse(id).success) return;
  await setFaqPublished(staff, id, published);
}

export async function deleteFaqAction(id: string): Promise<void> {
  const staff = await editor();
  if (!staff || !z.uuid().safeParse(id).success) return;
  await deleteFaqItem(staff, id);
}
