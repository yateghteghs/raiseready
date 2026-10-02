import { AFRICAN_COUNTRIES, COUNTRY_CURRENCY } from "@/lib/currency/countries";
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

/** Symbol and code, e.g. "KSh KES"; just the code when there's no distinct symbol. */
function currencyLabel(code: string): string {
  const symbol =
    new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? code;
  return symbol === code ? code : `${symbol} ${code}`;
}

/** US dollars first, then every African currency, then euros and pounds. */
export const CURRENCY_OPTIONS: Option[] = [
  "USD",
  ...[...new Set(Object.values(COUNTRY_CURRENCY))].sort(),
  "EUR",
  "GBP",
].map((code) => ({ value: code, label: currencyLabel(code) }));

export const COUNTRY_OPTIONS: Option[] = [...AFRICAN_COUNTRIES.map((c) => c.name), "Other"].map((c) => ({ value: c, label: c }));

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
