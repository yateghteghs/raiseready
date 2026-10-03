export const SITE = {
  name: "RaiseReady",
  tagline: "Don't practice on investors. Practice on AI first.",
  /** Public contact address for privacy and support requests. Not yet chosen. */
  contactEmail: null as string | null,
  /** Sender for emails RaiseReady sends itself (staff invites, tests); must be on a domain verified in Mailtrap. */
  email: {
    from: "hello@indexprima.com",
    fromName: "RaiseReady",
  },
  /** The registered business that owns and operates RaiseReady. */
  company: {
    name: "Index Prima",
    registration: "BN 9430651",
    /** Registered business address for the legal pages. Not yet given. */
    address: null as string | null,
  },
};

export const MARKETING_NAV = [
  { href: "/how-it-works", key: "howItWorks" },
  { href: "/pricing", key: "pricing" },
  { href: "/faq", key: "faq" },
  { href: "/about", key: "about" },
] as const;
