export const SITE = {
  name: "RaiseReady",
  tagline: "Don't practice on investors. Practice on AI first.",
  /** Public contact address for privacy and support requests (a real mailbox). */
  contactEmail: "raiseready@indexprima.com" as string | null,
  /**
   * Who emails come from (addresses must be on a domain verified in Mailtrap).
   * - system: automatic account emails nobody should reply to (sign-up
   *   confirmation, password reset, sign-in links, codes).
   * - personal: emails from a person, where a reply is welcome (staff
   *   invites, test emails, future welcome and product emails). Replies only
   *   reach someone if this address has a mailbox or forwarder.
   */
  email: {
    system: { email: "no-reply@indexprima.com", name: "RaiseReady" },
    personal: { email: "raiseready@indexprima.com", name: "Mhenuter from RaiseReady" },
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
