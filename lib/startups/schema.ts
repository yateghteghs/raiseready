import { z } from "zod";

import {
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  FUNDING_TYPE_OPTIONS,
  INDUSTRY_OPTIONS,
  STAGE_OPTIONS,
  type Option,
} from "@/lib/startups/options";
import type { Tables, TablesInsert } from "@/lib/supabase/database.types";

// ---------------------------------------------------------------------------
// Field helpers: HTML forms send strings, with "" for anything left blank.
// ---------------------------------------------------------------------------

const blankToUndefined = (v: unknown) =>
  typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : v;

function oneOf<T extends string>(options: Option<T>[], message: string) {
  const values = options.map((o) => o.value) as [T, ...T[]];
  return z.enum(values, { error: message });
}

const requiredText = (label: string, max: number) =>
  z.preprocess(
    blankToUndefined,
    z
      .string({ error: `Enter ${label}.` })
      .max(max, { error: `Use at most ${max} characters.` }),
  );

const optionalText = (max: number) =>
  z.preprocess(
    blankToUndefined,
    z.string().max(max, { error: `Use at most ${max} characters.` }).optional(),
  );

const optionalAmount = z.preprocess(
  (v) => {
    const s = blankToUndefined(v);
    return typeof s === "string" ? Number(s.replace(/[,\s₦$]/g, "")) : s;
  },
  z
    .number({ error: "Enter a number." })
    .finite({ error: "Enter a number." })
    .nonnegative({ error: "Must be zero or more." })
    .max(1e15, { error: "That number is too large." })
    .optional(),
);

const optionalCount = z.preprocess(
  (v) => {
    const s = blankToUndefined(v);
    return typeof s === "string" ? Number(s.replace(/[,\s]/g, "")) : s;
  },
  z
    .number({ error: "Enter a whole number." })
    .int({ error: "Enter a whole number." })
    .nonnegative({ error: "Must be zero or more." })
    .max(2_000_000_000, { error: "That number is too large." })
    .optional(),
);

const optionalYear = z.preprocess(
  (v) => {
    const s = blankToUndefined(v);
    return typeof s === "string" ? Number(s) : s;
  },
  z
    .number({ error: "Enter a year, e.g. 2022." })
    .int({ error: "Enter a year, e.g. 2022." })
    .min(1900, { error: "Enter a year after 1900." })
    .refine((y) => y <= new Date().getFullYear(), { error: "That year is in the future." })
    .optional(),
);

/** "yes" / "no" radio values; blank means not answered. */
const optionalYesNo = z.preprocess(
  (v) => (v === "yes" ? true : v === "no" ? false : undefined),
  z.boolean().optional(),
);

const currency = z.preprocess(
  (v) => blankToUndefined(v) ?? "NGN",
  oneOf(CURRENCY_OPTIONS, "Choose a currency."),
);

const website = z.preprocess(
  (v) => {
    const s = blankToUndefined(v);
    if (typeof s !== "string") return s;
    // Add https:// to bare domains; leave any other scheme for the URL check.
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  },
  z
    .url({ protocol: /^https?$/, error: "Enter a valid website, e.g. example.com." })
    .max(300)
    .optional(),
);

// ---------------------------------------------------------------------------
// Form sections. Onboarding shows one section per step; the startup profile
// page shows the company, traction and fundraising sections together.
// ---------------------------------------------------------------------------

export const aboutYouSchema = z.object({
  full_name: requiredText("your name", 100).pipe(
    z.string().min(2, { error: "Enter your name." }),
  ),
  country: oneOf(COUNTRY_OPTIONS, "Choose the country you're based in."),
});

export const companySchema = z.object({
  name: requiredText("your startup's name", 200),
  website,
  industry: oneOf(INDUSTRY_OPTIONS, "Choose an industry."),
  startup_country: oneOf(COUNTRY_OPTIONS, "Choose where the startup mainly operates."),
  founding_year: optionalYear,
  stage: oneOf(STAGE_OPTIONS, "Choose your stage."),
});

export const tractionSchema = z.object({
  business_model: optionalText(2000),
  customers_count: optionalCount,
  revenue_monthly: optionalAmount,
  revenue_currency: currency,
  growth_notes: optionalText(2000),
});

export const fundraisingSchema = z
  .object({
    raising: z.preprocess((v) => v === "yes", z.boolean()),
    amount_seeking: optionalAmount,
    seeking_currency: currency,
    funding_type: z.preprocess(
      blankToUndefined,
      oneOf(FUNDING_TYPE_OPTIONS, "Choose a funding type.").optional(),
    ),
    previously_raised: optionalYesNo,
    use_of_funds: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    if (v.raising && v.amount_seeking === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["amount_seeking"],
        message: "Enter how much you're raising.",
      });
    }
  });

export const startupSchema = z.object({
  ...companySchema.shape,
  ...tractionSchema.shape,
}).and(fundraisingSchema);

export const onboardingSchema = aboutYouSchema.and(startupSchema);

export type StartupInput = z.infer<typeof startupSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const ONBOARDING_STEPS = [
  { id: "you", title: "About you", schema: aboutYouSchema },
  { id: "company", title: "Your startup", schema: companySchema },
  { id: "traction", title: "Business & traction", schema: tractionSchema },
  { id: "fundraising", title: "Fundraising", schema: fundraisingSchema },
] as const;

/** Index of the first onboarding step containing any of the given fields. */
export function firstStepWithError(fields: string[]): number {
  const index = ONBOARDING_STEPS.findIndex((step) => {
    const keys = Object.keys(
      "shape" in step.schema ? step.schema.shape : (step.schema as typeof fundraisingSchema).shape,
    );
    return fields.some((f) => keys.includes(f));
  });
  return index === -1 ? 0 : index;
}

/** Maps validated form input to a startups row (blank answers become null). */
export function toStartupRow(input: StartupInput): Omit<TablesInsert<"startups">, "owner_id"> {
  return {
    name: input.name,
    website: input.website ?? null,
    industry: input.industry,
    country: input.startup_country,
    founding_year: input.founding_year ?? null,
    stage: input.stage,
    business_model: input.business_model ?? null,
    customers_count: input.customers_count ?? null,
    revenue_monthly: input.revenue_monthly ?? null,
    revenue_currency: input.revenue_currency,
    growth_notes: input.growth_notes ?? null,
    raising: input.raising,
    amount_seeking: input.raising ? (input.amount_seeking ?? null) : null,
    seeking_currency: input.seeking_currency,
    funding_type: input.funding_type ?? null,
    previously_raised: input.previously_raised ?? null,
    use_of_funds: input.use_of_funds ?? null,
  };
}

const yesNo = (v: boolean | null | undefined) => (v === true ? "yes" : v === false ? "no" : "");
const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/** Form defaults for an existing startup and profile. */
export function toFormValues(
  startup: Tables<"startups"> | null,
  profile?: Pick<Tables<"profiles">, "full_name" | "country"> | null,
): Record<string, string> {
  return {
    full_name: str(profile?.full_name),
    country: str(profile?.country),
    name: str(startup?.name),
    website: str(startup?.website),
    industry: str(startup?.industry),
    startup_country: str(startup?.country ?? profile?.country),
    founding_year: str(startup?.founding_year),
    stage: str(startup?.stage),
    business_model: str(startup?.business_model),
    customers_count: str(startup?.customers_count),
    revenue_monthly: str(startup?.revenue_monthly),
    revenue_currency: startup?.revenue_currency ?? "NGN",
    growth_notes: str(startup?.growth_notes),
    raising: startup ? yesNo(startup.raising) : "",
    amount_seeking: str(startup?.amount_seeking),
    seeking_currency: startup?.seeking_currency ?? "NGN",
    funding_type: str(startup?.funding_type),
    previously_raised: yesNo(startup?.previously_raised),
    use_of_funds: str(startup?.use_of_funds),
  };
}
