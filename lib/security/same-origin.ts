/**
 * CSRF protection for route handlers that change data (spec section 8): the
 * request must come from a page on this same site. Server Actions get the
 * equivalent check from Next.js automatically.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
