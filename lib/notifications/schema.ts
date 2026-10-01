import { z } from "zod";

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** Links in notifications may only point inside the signed-in app, so they can't be used for phishing. */
export function isAppLink(link: string): boolean {
  return /^\/app(\/[A-Za-z0-9\-_/]*)?(\?[A-Za-z0-9=&\-_]*)?$/.test(link) && !link.includes("//");
}

export const notificationSchema = z
  .object({
    audience: z.enum(["all", "one"], { error: "Choose who receives it." }),
    email: z.preprocess(blankToUndefined, z.email({ error: "Enter a valid email address." }).optional()),
    title: z.string().trim().min(1, { error: "Add a title." }).max(120, { error: "Use at most 120 characters." }),
    body: z.string().trim().min(1, { error: "Write the message." }).max(2000, { error: "Use at most 2,000 characters." }),
    link: z.preprocess(
      blankToUndefined,
      z
        .string()
        .trim()
        .refine(isAppLink, { error: "Use a page inside the app, starting with /app (e.g. /app/billing)." })
        .optional(),
    ),
  })
  .refine((v) => v.audience === "all" || v.email, { path: ["email"], error: "Enter the user's email address." });

export type NotificationInput = z.infer<typeof notificationSchema>;
