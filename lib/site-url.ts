import { headers } from "next/headers";

/**
 * The public base URL of the app, used in links inside auth emails.
 * Prefers APP_URL; falls back to the request's own origin.
 */
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
