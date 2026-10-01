import { z } from "zod";

import { aboutYouSchema } from "@/lib/startups/schema";

export const accountDetailsSchema = aboutYouSchema;

/** The founder must type this to confirm deletion. */
export const DELETE_CONFIRMATION = "DELETE";

export const deleteAccountSchema = z.object({
  confirm: z
    .string()
    .trim()
    .refine((v) => v.toUpperCase() === DELETE_CONFIRMATION, { error: `Type ${DELETE_CONFIRMATION} to confirm.` }),
});
