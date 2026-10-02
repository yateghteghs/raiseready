import type { Locale } from "@/lib/i18n/config";
import { ar } from "@/lib/i18n/messages/ar";
import { en, type Messages } from "@/lib/i18n/messages/en";
import { fr } from "@/lib/i18n/messages/fr";
import { ha } from "@/lib/i18n/messages/ha";
import { ig } from "@/lib/i18n/messages/ig";
import { pt } from "@/lib/i18n/messages/pt";
import { sw } from "@/lib/i18n/messages/sw";
import { yo } from "@/lib/i18n/messages/yo";

export const DICTIONARIES: Record<Locale, Messages> = { en, fr, pt, sw, ar, ha, yo, ig };
