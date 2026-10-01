import { randomUUID } from "node:crypto";

import type { Staff } from "@/lib/admin/auth";
import { IMAGES_BUCKET, validateImage } from "@/lib/images/rules";
import { imageLink, imageBytes } from "@/lib/images/service";
import type { ReportSigner } from "@/lib/reports/pdf";
import { createAdminClient } from "@/lib/supabase/admin";

/** The signature image lives in the private images bucket under this folder. */
const SITE_FOLDER = "site";

export class SignatureError extends Error {}

export async function getSignatureSettings() {
  const { data, error } = await createAdminClient().from("report_signature").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Could not load signature settings: ${error.message}`);
  return {
    signer_name: data?.signer_name ?? "",
    signer_title: data?.signer_title ?? "",
    enabled: data?.enabled ?? false,
    imageUrl: await imageLink(SITE_FOLDER, data?.signature_path),
    hasImage: Boolean(data?.signature_path),
  };
}

/** Saves who signs reports. A new signature image replaces the old one. */
export async function saveSignatureSettings(
  staff: Staff,
  input: { signer_name: string; signer_title?: string; enabled: boolean; removeImage?: boolean },
  image?: Uint8Array | null,
): Promise<void> {
  const admin = createAdminClient();
  const { data: current } = await admin.from("report_signature").select("signature_path").eq("id", 1).maybeSingle();
  let path = current?.signature_path ?? null;
  const storage = admin.storage.from(IMAGES_BUCKET);
  const old = path;

  if (image && image.length) {
    const check = validateImage(image);
    if (!check.ok) throw new SignatureError(check.message);
    path = `${SITE_FOLDER}/signature-${randomUUID()}.${check.ext}`;
    const { error } = await storage.upload(path, image, { contentType: check.mime });
    if (error) throw new Error(`Could not upload signature: ${error.message}`);
  } else if (input.removeImage) {
    path = null;
  }

  const { error } = await admin.from("report_signature").upsert({
    id: 1,
    signer_name: input.signer_name,
    signer_title: input.signer_title || null,
    signature_path: path,
    enabled: input.enabled,
    updated_by: staff.id,
  });
  if (error) throw new Error(`Could not save signature settings: ${error.message}`);
  if (old && old !== path) await storage.remove([old]);

  await admin.from("audit_logs").insert({
    actor_id: staff.id,
    action: "admin.report_signature_updated",
    target_type: "settings",
    metadata: { enabled: input.enabled, image_changed: old !== path },
  });
}

/** The signer to print on new reports, or null when switched off or incomplete. */
export async function signerForReports(): Promise<ReportSigner | null> {
  const { data } = await createAdminClient().from("report_signature").select("*").eq("id", 1).maybeSingle();
  if (!data?.enabled || !data.signer_name) return null;
  return { name: data.signer_name, title: data.signer_title, image: await imageBytes(SITE_FOLDER, data.signature_path) };
}
