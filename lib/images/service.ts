import { randomUUID } from "node:crypto";

import { IMAGES_BUCKET, ownsImagePath, validateImage, type ImageKind } from "@/lib/images/rules";
import { createAdminClient } from "@/lib/supabase/admin";

/** An image problem the founder can fix; the message is shown to them. */
export class ImageError extends Error {}

/** How long a viewing link lasts. Pages create fresh ones on each load. */
const LINK_SECONDS = 60 * 60;

async function currentPath(userId: string, kind: ImageKind, startupId?: string): Promise<string | null> {
  const admin = createAdminClient();
  if (kind === "avatar") {
    const { data } = await admin.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
    return data?.avatar_path ?? null;
  }
  const { data } = await admin.from("startups").select("logo_path").eq("id", startupId!).eq("owner_id", userId).maybeSingle();
  return data?.logo_path ?? null;
}

async function savePath(userId: string, kind: ImageKind, path: string | null, startupId?: string) {
  const admin = createAdminClient();
  const { error, data } =
    kind === "avatar"
      ? await admin.from("profiles").update({ avatar_path: path }).eq("id", userId).select("id")
      : await admin.from("startups").update({ logo_path: path }).eq("id", startupId!).eq("owner_id", userId).select("id");
  if (error) throw new Error(`Could not save image: ${error.message}`);
  if (!data?.length) throw new ImageError(kind === "logo" ? "Set up your startup profile first." : "Profile not found.");
}

/**
 * Stores a profile picture or company logo after checking its content, then
 * removes the one it replaces. Written with the service role because founders
 * can't set image paths themselves (see the RLS migration).
 */
export async function saveImage(userId: string, kind: ImageKind, bytes: Uint8Array, startupId?: string): Promise<void> {
  if (kind === "logo" && !startupId) throw new ImageError("Set up your startup profile first.");
  const check = validateImage(bytes);
  if (!check.ok) throw new ImageError(check.message);

  const previous = await currentPath(userId, kind, startupId);
  const path = `${userId}/${kind}-${randomUUID()}.${check.ext}`;
  const storage = createAdminClient().storage.from(IMAGES_BUCKET);
  const { error } = await storage.upload(path, bytes, { contentType: check.mime });
  if (error) throw new Error(`Could not upload image: ${error.message}`);

  try {
    await savePath(userId, kind, path, startupId);
  } catch (cause) {
    await storage.remove([path]);
    throw cause;
  }
  if (ownsImagePath(previous, userId)) await storage.remove([previous]);
}

export async function removeImage(userId: string, kind: ImageKind, startupId?: string): Promise<void> {
  const previous = await currentPath(userId, kind, startupId);
  await savePath(userId, kind, null, startupId);
  if (ownsImagePath(previous, userId)) await createAdminClient().storage.from(IMAGES_BUCKET).remove([previous]);
}

/**
 * Short-lived viewing links for images, keyed by path. Callers decide who may
 * see which images; each path must sit in its owner's folder.
 */
export async function imageLinks(images: { ownerId: string; path: string | null | undefined }[]): Promise<Record<string, string>> {
  const paths = images.filter((i) => ownsImagePath(i.path, i.ownerId)).map((i) => i.path as string);
  if (!paths.length) return {};
  const { data, error } = await createAdminClient().storage.from(IMAGES_BUCKET).createSignedUrls(paths, LINK_SECONDS);
  if (error) {
    console.error(`Could not create image links: ${error.message}`);
    return {};
  }
  const links: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) links[d.path] = d.signedUrl;
  return links;
}

/** One image link, or null. */
export async function imageLink(ownerId: string, path: string | null | undefined): Promise<string | null> {
  if (!ownsImagePath(path, ownerId)) return null;
  return (await imageLinks([{ ownerId, path }]))[path] ?? null;
}

/** The logo's bytes for the PDF report, or null if there isn't one (or it can't be read). */
export async function logoBytes(ownerId: string, path: string | null | undefined): Promise<Buffer | null> {
  if (!ownsImagePath(path, ownerId)) return null;
  const { data, error } = await createAdminClient().storage.from(IMAGES_BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
