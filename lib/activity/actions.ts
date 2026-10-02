"use server";

import { z } from "zod";

import { recordError } from "@/lib/activity/service";
import { getCurrentUser } from "@/lib/auth/session";

const schema = z.object({
  message: z.string().max(2000),
  path: z.string().max(500),
});

/** Records an error that happened only in the browser (server errors are recorded on the server). */
export async function reportBrowserError(input: { message: string; path: string }): Promise<void> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return;
  const user = await getCurrentUser().catch(() => null);
  await recordError({ source: "browser", message: parsed.data.message, path: parsed.data.path, userId: user?.id ?? null });
}
