import { DEFAULT_AFTER_LOGIN } from "@/lib/auth/redirect";

const PROTECTED_PREFIXES = ["/app", "/admin"] as const;
/** The admin sign-in page lives under /admin but must stay reachable. */
export const ADMIN_LOGIN_PATH = "/admin/login";
const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password"] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string): boolean {
  if (pathname === ADMIN_LOGIN_PATH) return false;
  return PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

/**
 * Decides whether a request should be redirected based on sign-in state.
 * Returns the path (with query) to redirect to, or null to continue.
 *
 * This is an optimistic check for fast redirects; pages under /app also verify
 * the user on the server before rendering anything.
 */
export function authRedirectFor(
  pathname: string,
  search: string,
  isSignedIn: boolean,
): string | null {
  if (!isSignedIn && isProtectedPath(pathname)) {
    const next = encodeURIComponent(`${pathname}${search}`);
    const login = matchesPrefix(pathname, "/admin") ? ADMIN_LOGIN_PATH : "/login";
    return `${login}?next=${next}`;
  }
  if (isSignedIn && GUEST_ONLY_PATHS.some((p) => pathname === p)) {
    return DEFAULT_AFTER_LOGIN;
  }
  return null;
}
