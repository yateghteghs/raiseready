/** Languages RaiseReady can be shown in. English is the default and the fallback. */
export const LOCALES = ["en", "fr", "pt", "sw", "ar", "ha", "yo", "ig"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Cookie that remembers the visitor's choice. */
export const LOCALE_COOKIE = "rr_locale";

/** Each language in its own name, for the picker, plus English name for staff screens. */
export const LOCALE_NAMES: Record<Locale, { native: string; english: string }> = {
  en: { native: "English", english: "English" },
  fr: { native: "Français", english: "French" },
  pt: { native: "Português", english: "Portuguese" },
  sw: { native: "Kiswahili", english: "Swahili" },
  ar: { native: "العربية", english: "Arabic" },
  ha: { native: "Hausa", english: "Hausa" },
  yo: { native: "Yorùbá", english: "Yoruba" },
  ig: { native: "Igbo", english: "Igbo" },
};

/** Languages written right to left. */
export const RTL_LOCALES: readonly Locale[] = ["ar"];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function dirOf(locale: Locale): "ltr" | "rtl" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}
