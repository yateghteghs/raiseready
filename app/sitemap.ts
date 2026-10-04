import type { MetadataRoute } from "next";

/** The public pages, for search engines. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.APP_URL?.replace(/\/+$/, "");
  if (!site) return [];
  const pages = ["", "/how-it-works", "/pricing", "/faq", "/about", "/teams", "/testimonials", "/partners", "/privacy", "/terms", "/register", "/login"];
  return pages.map((path) => ({
    url: `${site}${path}`,
    changeFrequency: path === "" || path === "/pricing" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/pricing" || path === "/how-it-works" ? 0.8 : 0.5,
  }));
}
