import { z } from "zod";

/**
 * Environment variables (spec section 10), validated with Zod.
 *
 * Public values must be read with literal `process.env.NEXT_PUBLIC_*`
 * expressions so Next.js can inline them into the client bundle.
 * Server values are only readable on the server; `serverEnv()` throws if it is
 * ever called from browser code.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).optional(),
  PAYSTACK_SECRET_KEY: z.string().min(1),
  APP_URL: z.url(),
  /** Mailtrap Email API token (Sending Domains → Integration → API). Optional: without it, nothing is emailed. */
  MAILTRAP_API_TOKEN: z.string().min(1).optional(),
  /** Secret for Supabase's Send Email hook (Authentication → Hooks), e.g. "v1,whsec_…". Optional. */
  SEND_EMAIL_HOOK_SECRET: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
}

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid public environment variables:\n${formatIssues(result.error)}`);
  }
  return result.data;
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid server environment variables:\n${formatIssues(result.error)}`);
  }
  return result.data;
}

export function publicEnv(): PublicEnv {
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

/**
 * Reads only the variables a caller needs, so a missing Paystack key does not
 * break a page that only talks to Supabase.
 */
export function serverEnv<K extends keyof ServerEnv>(...keys: K[]): Pick<ServerEnv, K> {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called from browser code");
  }
  const shape = serverSchema.shape;
  const picked: Partial<ServerEnv> = {};
  const issues: string[] = [];
  for (const key of keys) {
    const result = shape[key].safeParse(process.env[key]);
    if (result.success) {
      picked[key] = result.data;
    } else {
      issues.push(`  - ${key}: ${result.error.issues[0]?.message ?? "invalid"}`);
    }
  }
  if (issues.length > 0) {
    throw new Error(`Invalid server environment variables:\n${issues.join("\n")}`);
  }
  return picked as Pick<ServerEnv, K>;
}

/** True when the Supabase settings the app needs on every request are present and valid. */
export function isSupabaseConfigured(): boolean {
  try {
    publicEnv();
    return true;
  } catch {
    return false;
  }
}
