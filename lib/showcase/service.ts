import { randomUUID } from "node:crypto";

import { revalidatePath, unstable_cache, updateTag } from "next/cache";

import type { Staff } from "@/lib/admin/auth";
import { validateImage } from "@/lib/images/rules";
import type { ShowcaseInput } from "@/lib/showcase/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, ShowcaseKind, Tables } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";

/** Public bucket: showcase images appear on the public website. */
export const SHOWCASE_BUCKET = "showcase";

export class ShowcaseError extends Error {}

export type ShowcaseItem = Tables<"showcase_items"> & { imageUrl: string | null };

function publicUrl(path: string | null): string | null {
  if (!path || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${SHOWCASE_BUCKET}/${path}`;
}

const SHOWCASE_TAG = "showcase";

const withUrls = (rows: Tables<"showcase_items">[]): ShowcaseItem[] => rows.map((r) => ({ ...r, imageUrl: publicUrl(r.image_path) }));

/** Errors throw so a failed read is never cached as "nothing published". */
const loadPublished = unstable_cache(
  async (): Promise<Tables<"showcase_items">[]> => {
    const client = createPublicClient();
    if (!client) return [];
    const { data, error } = await client.from("showcase_items").select("*").eq("published", true)
      .order("position")
      .order("created_at")
      // Give up (retries included) rather than hold the page up.
      .abortSignal(AbortSignal.timeout(3000));
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["showcase-published"],
  { tags: [SHOWCASE_TAG], revalidate: 300 },
);

/** Published items for the public site. Never throws: public pages render without them. */
export async function publishedShowcase(kind?: ShowcaseKind): Promise<ShowcaseItem[]> {
  try {
    const rows = await loadPublished();
    return withUrls(kind ? rows.filter((r) => r.kind === kind) : rows);
  } catch (error) {
    console.error(`Could not load showcase: ${error instanceof Error ? error.message : error}`);
    return [];
  }
}

/** Every item, drafts included, for the admin page. */
export async function allShowcase(): Promise<ShowcaseItem[]> {
  const { data, error } = await createAdminClient().from("showcase_items").select("*").order("kind").order("position").order("created_at");
  if (error) throw new Error(`Could not load showcase: ${error.message}`);
  return withUrls(data ?? []);
}

function refreshPublicPages() {
  updateTag(SHOWCASE_TAG);
  for (const path of ["/", "/testimonials", "/partners"]) revalidatePath(path);
}

async function audit(staff: Staff, action: string, id: string, metadata: Record<string, unknown> = {}) {
  await createAdminClient().from("audit_logs").insert({ actor_id: staff.id, action, target_type: "showcase_item", target_id: id, metadata: metadata as Json });
}

export async function createShowcaseItem(staff: Staff, input: ShowcaseInput, image?: Uint8Array | null): Promise<void> {
  if ((input.kind === "logo" || input.kind === "partner") && !image?.length) throw new ShowcaseError("Add the logo image.");
  const admin = createAdminClient();
  let imagePath: string | null = null;
  if (image?.length) {
    const check = validateImage(image);
    if (!check.ok) throw new ShowcaseError(check.message);
    imagePath = `${input.kind}/${randomUUID()}.${check.ext}`;
    const { error } = await admin.storage.from(SHOWCASE_BUCKET).upload(imagePath, image, { contentType: check.mime });
    if (error) throw new Error(`Could not upload image: ${error.message}`);
  }
  const { data, error } = await admin
    .from("showcase_items")
    .insert({ ...input, quote: input.quote ?? null, person_name: input.person_name ?? null, person_title: input.person_title ?? null, url: input.url ?? null, image_path: imagePath, created_by: staff.id })
    .select("id")
    .single();
  if (error) {
    if (imagePath) await admin.storage.from(SHOWCASE_BUCKET).remove([imagePath]);
    throw new Error(`Could not save item: ${error.message}`);
  }
  await audit(staff, "admin.showcase_created", data.id, { kind: input.kind, published: input.published });
  refreshPublicPages();
}

export async function setShowcasePublished(staff: Staff, id: string, published: boolean): Promise<void> {
  const admin = createAdminClient();
  const { data: item } = await admin.from("showcase_items").select("permission_confirmed").eq("id", id).maybeSingle();
  if (!item) throw new ShowcaseError("That item no longer exists.");
  if (published && !item.permission_confirmed) throw new ShowcaseError("Confirm permission before publishing.");
  const { error } = await admin.from("showcase_items").update({ published }).eq("id", id);
  if (error) throw new Error(`Could not update item: ${error.message}`);
  await audit(staff, published ? "admin.showcase_published" : "admin.showcase_hidden", id);
  refreshPublicPages();
}

export async function deleteShowcaseItem(staff: Staff, id: string): Promise<void> {
  const admin = createAdminClient();
  const { data: item } = await admin.from("showcase_items").select("image_path").eq("id", id).maybeSingle();
  const { error } = await admin.from("showcase_items").delete().eq("id", id);
  if (error) throw new Error(`Could not delete item: ${error.message}`);
  if (item?.image_path) await admin.storage.from(SHOWCASE_BUCKET).remove([item.image_path]);
  await audit(staff, "admin.showcase_deleted", id);
  refreshPublicPages();
}
