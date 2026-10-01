"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getStaff } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { formValues, validationFailed, type FormState } from "@/lib/forms";
import { saveSignatureSettings, SignatureError } from "@/lib/reports/signature";

const schema = z
  .object({
    signer_name: z.string().trim().max(120, { error: "Use at most 120 characters." }),
    signer_title: z.string().trim().max(120, { error: "Use at most 120 characters." }).optional(),
    enabled: z.preprocess((v) => v === "on", z.boolean()),
    remove_image: z.preprocess((v) => v === "on", z.boolean()),
  })
  .refine((v) => !v.enabled || v.signer_name.length > 0, { path: ["signer_name"], error: "Enter the signer's name to switch this on." });

export async function saveSignatureAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await getStaff();
  if (!staff || !can(staff.profile.role, "manage_content")) return { status: "error", message: "Only a super admin can change the report signature." };
  const values = formValues(formData);
  const parsed = schema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  const file = formData.get("image");
  const image = file instanceof File && file.size > 0 ? new Uint8Array(await file.arrayBuffer()) : null;
  try {
    await saveSignatureSettings(
      staff,
      { signer_name: parsed.data.signer_name, signer_title: parsed.data.signer_title, enabled: parsed.data.enabled, removeImage: parsed.data.remove_image },
      image,
    );
  } catch (error) {
    if (error instanceof SignatureError) return { status: "error", message: error.message, values };
    console.error("[signature] save failed:", error);
    return { status: "error", message: "Something went wrong. Nothing was saved.", values };
  }
  revalidatePath("/admin/report-signature");
  return { status: "success", message: parsed.data.enabled ? "Saved. New PDF reports will carry this signature." : "Saved. Reports won't carry a signature." };
}
