import type { Messages } from "@/lib/i18n/messages/en";

/** Fills `{name}` placeholders. Unknown placeholders are left as they are. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

const escape = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
const patterns = new Map<string, { re: RegExp; names: string[] }>();

function patternOf(template: string) {
  let p = patterns.get(template);
  if (!p) {
    const names: string[] = [];
    const parts = template.split(/\{(\w+)\}/);
    const source = parts.map((part, i) => (i % 2 ? (names.push(part), "(.+?)") : escape(part))).join("");
    p = { re: new RegExp(`^${source}$`, "s"), names };
    patterns.set(template, p);
  }
  return p;
}

/**
 * Translates a message written in English on the server, such as a form
 * error. Messages with values in them ("Use at least 8 characters.") match
 * their `{placeholder}` template. Unknown messages are returned unchanged.
 */
export function translateText(messages: Messages, english: string): string {
  const exact = messages.text[english as keyof Messages["text"]];
  if (exact) return exact;
  for (const [template, translated] of Object.entries(messages.text)) {
    if (!template.includes("{")) continue;
    const { re, names } = patternOf(template);
    const match = re.exec(english);
    if (match) return fill(translated, Object.fromEntries(names.map((n, i) => [n, match[i + 1]])));
  }
  return english;
}
