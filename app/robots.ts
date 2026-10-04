import type { MetadataRoute } from "next";

/** Public pages may be indexed; the app, admin, API and shared reports may not. */
export default function robots(): MetadataRoute.Robots {
  const site = process.env.APP_URL?.replace(/\/+$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/api", "/auth", "/shared", "/join", "/status"] },
    ...(site ? { sitemap: `${site}/sitemap.xml` } : {}),
  };
}
