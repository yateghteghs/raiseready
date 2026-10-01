/** Where signed-in users land by default. */
export const DEFAULT_AFTER_LOGIN = "/app";

/**
 * Accepts only same-site relative paths for post-login redirects, so a crafted
 * `?next=` link cannot send someone to another website.
 */
export function safeNextPath(next: unknown, fallback: string = DEFAULT_AFTER_LOGIN): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  try {
    const url = new URL(next, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
