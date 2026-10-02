import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Staff } from "@/lib/admin/auth";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";

export type FaqItem = Pick<Tables<"faq_items">, "id" | "category" | "question" | "answer" | "position">;

export const faqSchema = z.object({
  locale: z.enum(LOCALES, { error: "Choose a language." }),
  category: z.string().trim().min(1, { error: "Add a section, e.g. Getting started." }).max(60),
  question: z.string().trim().min(1, { error: "Write the question." }).max(300),
  answer: z.string().trim().min(1, { error: "Write the answer." }).max(4000),
  position: z.preprocess((v) => (v === "" ? 0 : v), z.coerce.number().int().min(0).max(9999)),
  published: z.preprocess((v) => v === "on", z.boolean()),
});
export type FaqInput = z.infer<typeof faqSchema>;

/**
 * The published FAQ in a language, grouped by section in display order.
 * Falls back to English when that language has no entries yet.
 * Never throws: the page shows an empty state instead.
 */
export async function publishedFaq(locale: Locale): Promise<{ locale: Locale; sections: { category: string; items: FaqItem[] }[] }> {
  const client = createPublicClient();
  if (!client) return { locale, sections: [] };
  const load = async (l: Locale) => {
    const { data, error } = await client
      .from("faq_items")
      .select("id, category, question, answer, position")
      .eq("published", true)
      .eq("locale", l)
      .order("position")
      .order("created_at");
    if (error) console.error(`Could not load FAQ: ${error.message}`);
    return data ?? [];
  };
  let used = locale;
  let items = await load(locale);
  if (!items.length && locale !== DEFAULT_LOCALE) {
    used = DEFAULT_LOCALE;
    items = await load(DEFAULT_LOCALE);
  }
  return { locale: used, sections: groupBySection(items) };
}

/** Sections in the order of their first entry, entries in position order. */
export function groupBySection(items: FaqItem[]): { category: string; items: FaqItem[] }[] {
  const sections = new Map<string, FaqItem[]>();
  for (const item of [...items].sort((a, b) => a.position - b.position)) {
    if (!sections.has(item.category)) sections.set(item.category, []);
    sections.get(item.category)!.push(item);
  }
  return [...sections.entries()].map(([category, list]) => ({ category, items: list }));
}

/** Every entry in a language, drafts included, for the admin page. */
export async function allFaq(locale: Locale): Promise<Tables<"faq_items">[]> {
  const { data, error } = await createAdminClient()
    .from("faq_items")
    .select("*")
    .eq("locale", locale)
    .order("position")
    .order("created_at");
  if (error) throw new Error(`Could not load FAQ: ${error.message}`);
  return data ?? [];
}

async function audit(staff: Staff, action: string, id: string) {
  await createAdminClient().from("audit_logs").insert({ actor_id: staff.id, action, target_type: "faq_item", target_id: id, metadata: {} });
}

function refresh() {
  revalidatePath("/faq");
  revalidatePath("/admin/faq");
}

export async function saveFaqItem(staff: Staff, input: FaqInput, id?: string): Promise<void> {
  const admin = createAdminClient();
  if (id) {
    const { error } = await admin.from("faq_items").update(input).eq("id", id);
    if (error) throw new Error(`Could not save FAQ entry: ${error.message}`);
    await audit(staff, "admin.faq_updated", id);
  } else {
    const { data, error } = await admin.from("faq_items").insert({ ...input, created_by: staff.id }).select("id").single();
    if (error) throw new Error(`Could not add FAQ entry: ${error.message}`);
    await audit(staff, "admin.faq_created", data.id);
  }
  refresh();
}

export async function setFaqPublished(staff: Staff, id: string, published: boolean): Promise<void> {
  const { error } = await createAdminClient().from("faq_items").update({ published }).eq("id", id);
  if (error) throw new Error(`Could not update FAQ entry: ${error.message}`);
  await audit(staff, published ? "admin.faq_published" : "admin.faq_hidden", id);
  refresh();
}

export async function deleteFaqItem(staff: Staff, id: string): Promise<void> {
  const { error } = await createAdminClient().from("faq_items").delete().eq("id", id);
  if (error) throw new Error(`Could not delete FAQ entry: ${error.message}`);
  await audit(staff, "admin.faq_deleted", id);
  refresh();
}
