export const SITE = {
  name: "RaiseReady",
  tagline: "Don't practice on investors. Practice on AI first.",
  /** Public contact address for privacy and support requests. Not yet chosen. */
  contactEmail: null as string | null,
};

export const MARKETING_NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
] as const;

/**
 * Planned features shown as "Coming soon" on the home page. Only list what is
 * actually scheduled, and remove each one when it ships.
 */
export const COMING_SOON = [
  { title: "Voice practice", body: "Answer the investor out loud, the way you will in the room." },
  { title: "More investor types", body: "Corporate VCs, impact investors, bank loan officers and diaspora angels." },
  { title: "Slide-by-slide deck feedback", body: "What each slide says to an investor, with suggested rewrites." },
  { title: "Data room checklist", body: "The documents investors will ask for at your stage, and which you're missing." },
  { title: "Practise in French", body: "For founders raising in Francophone Africa, with plain-language explanations." },
  { title: "Team accounts", body: "For accelerators and hubs: one bill for your cohort and a view of everyone's progress." },
] as const;
