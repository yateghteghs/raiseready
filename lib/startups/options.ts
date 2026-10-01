import type { FundingType, StartupStage } from "@/lib/supabase/database.types";

export type Option<T extends string = string> = { value: T; label: string };

export const STAGE_OPTIONS: Option<StartupStage>[] = [
  { value: "idea", label: "Idea" },
  { value: "pre_seed", label: "Pre-seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "other", label: "Other" },
];

export const FUNDING_TYPE_OPTIONS: Option<FundingType>[] = [
  { value: "equity", label: "Equity" },
  { value: "safe", label: "SAFE" },
  { value: "convertible_note", label: "Convertible note" },
  { value: "grant", label: "Grant" },
  { value: "debt", label: "Debt" },
  { value: "other", label: "Other" },
];

export const CURRENCY_OPTIONS: Option[] = [
  { value: "NGN", label: "₦ NGN" },
  { value: "USD", label: "$ USD" },
  { value: "GHS", label: "GH₵ GHS" },
  { value: "KES", label: "KSh KES" },
  { value: "ZAR", label: "R ZAR" },
  { value: "EGP", label: "E£ EGP" },
  { value: "EUR", label: "€ EUR" },
  { value: "GBP", label: "£ GBP" },
];

export const COUNTRY_OPTIONS: Option[] = [
  "Nigeria",
  "Ghana",
  "Kenya",
  "South Africa",
  "Egypt",
  "Rwanda",
  "Uganda",
  "Tanzania",
  "Ethiopia",
  "Côte d'Ivoire",
  "Senegal",
  "Cameroon",
  "Morocco",
  "Other",
].map((c) => ({ value: c, label: c }));

export const INDUSTRY_OPTIONS: Option[] = [
  "Fintech",
  "Agritech",
  "Healthtech",
  "Edtech",
  "E-commerce & retail",
  "Logistics & mobility",
  "Energy & climate",
  "B2B software",
  "Media & entertainment",
  "Proptech",
  "Other",
].map((c) => ({ value: c, label: c }));

export function labelFor<T extends string>(options: Option<T>[], value: T | null | undefined) {
  return options.find((o) => o.value === value)?.label ?? value ?? null;
}
