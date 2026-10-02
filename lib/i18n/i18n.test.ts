import { describe, expect, it } from "vitest";

import { dirOf, isLocale, LOCALES } from "@/lib/i18n/config";
import { DICTIONARIES } from "@/lib/i18n/messages";
import { en } from "@/lib/i18n/messages/en";
import { fill, translateText } from "@/lib/i18n/text";

/** Every leaf as "path → value", so dictionaries can be compared key by key. */
function leaves(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
}
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  const english = new Map(leaves(en));

  it.each(LOCALES)("%s has every English entry, each translated, with the same placeholders", (locale) => {
    const entries = new Map(leaves(DICTIONARIES[locale]));
    expect([...entries.keys()].sort()).toEqual([...english.keys()].sort());
    for (const [path, value] of entries) {
      expect(value.trim(), path).not.toBe("");
      expect(placeholders(value), path).toEqual(placeholders(english.get(path)!));
    }
  });

  it("keys the server messages by their English text", () => {
    for (const [key, value] of Object.entries(en.text)) expect(value).toBe(key);
  });
});

describe("translateText", () => {
  const fr = DICTIONARIES.fr;

  it("translates exact messages and leaves unknown ones in English", () => {
    expect(translateText(fr, "Passwords do not match.")).toBe("Les mots de passe ne correspondent pas.");
    expect(translateText(fr, "Something new.")).toBe("Something new.");
  });

  it("matches messages that carry values", () => {
    expect(translateText(fr, "Use at least 8 characters.")).toBe("Utilisez au moins 8 caractères.");
    expect(translateText(fr, "We've sent a confirmation link to a.b+c@x.io. Open it to activate your account.")).toBe(
      "Nous avons envoyé un lien de confirmation à a.b+c@x.io. Ouvrez-le pour activer votre compte.",
    );
    expect(translateText(DICTIONARIES.sw, "Something went wrong. Please try again. (Error code: weird_code)")).toContain("weird_code");
  });

  it("fills placeholders", () => {
    expect(fill("{n} of {total}", { n: 2, total: 5 })).toBe("2 of 5");
    expect(fill("{unknown} stays", {})).toBe("{unknown} stays");
  });
});

describe("locale config", () => {
  it("knows which languages read right to left", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("fr")).toBe("ltr");
    expect(isLocale("yo")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
