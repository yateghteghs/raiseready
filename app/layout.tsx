import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { cookies } from "next/headers";

import { CookieBanner } from "@/components/consent/cookie-banner";
import { CONSENT_COOKIE, isConsent } from "@/lib/consent";
import { dirOf } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/server";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  // latin-ext and vietnamese cover Yoruba and Igbo letters such as ẹ, ọ, ṣ and ụ.
  subsets: ["latin", "latin-ext", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "RaiseReady: Practice your pitch on AI first",
    template: "%s | RaiseReady",
  },
  description:
    "AI-powered fundraising simulator for African founders. Get a readiness assessment, face a tough AI investor, and fix weaknesses before the real meeting.",
  applicationName: "RaiseReady",
  publisher: "Index Prima",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [{ locale, m }, jar] = await Promise.all([getMessages(), cookies()]);
  const decided = isConsent(jar.get(CONSENT_COOKIE)?.value);
  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {children}
        {decided ? null : <CookieBanner t={m.cookies} />}
      </body>
    </html>
  );
}
