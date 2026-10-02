import { cookies } from "next/headers";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { DICTIONARIES } from "@/lib/i18n/messages";
import type { Messages } from "@/lib/i18n/messages/en";
import { translateText } from "@/lib/i18n/text";
import type { FormState } from "@/lib/forms";

/** The visitor's chosen language, from their cookie. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getMessages(): Promise<{ locale: Locale; m: Messages }> {
  const locale = await getLocale();
  return { locale, m: DICTIONARIES[locale] };
}

/** Translates a form result's messages into the visitor's language. */
export async function localiseState(state: FormState): Promise<FormState> {
  const locale = await getLocale();
  if (locale === DEFAULT_LOCALE) return state;
  const m = DICTIONARIES[locale];
  return {
    ...state,
    message: state.message ? translateText(m, state.message) : state.message,
    fieldErrors: state.fieldErrors
      ? Object.fromEntries(Object.entries(state.fieldErrors).map(([k, v]) => [k, v?.map((e) => translateText(m, e))]))
      : state.fieldErrors,
  };
}
