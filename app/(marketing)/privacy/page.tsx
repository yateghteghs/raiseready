import type { Metadata } from "next";

import { ContactEmail, LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        This policy explains, in plain language, what RaiseReady stores about you, who it is shared
        with, and how to delete it. It is written with the Nigeria Data Protection Act 2023 in mind.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address, country and an encrypted
          password (we never see your password itself). If you add one, a profile picture.
        </li>
        <li>
          <strong>Startup profile:</strong> what you enter about your startup, such as stage, revenue,
          customers and fundraising plans, and your company logo if you add one. Your profile picture
          and logo are stored privately. Only you and RaiseReady staff can see them; your logo also
          appears on your own PDF reports. They are not sent to our AI provider.
        </li>
        <li>
          <strong>Documents you upload:</strong> your pitch deck and, if you add them, your financial
          model and business plan.
        </li>
        <li>
          <strong>What we generate for you:</strong> the structured profile extracted from your
          documents, readiness assessments, Investor Room conversations, red flags and reports.
        </li>
        <li>
          <strong>Payment records:</strong> what you bought, the amount and the payment status. Card
          details are handled by Paystack; we never receive or store them.
        </li>
        <li>
          <strong>Usage records:</strong> when AI features were used and how much processing they took,
          so we can manage costs and prevent abuse. These records don&apos;t contain your documents or
          answers.
        </li>
        <li>
          <strong>Account status:</strong> if staff suspend or close an account, when it happened and
          the reason they recorded.
        </li>
      </ul>

      <h2>What is sent to our AI provider</h2>
      <p>
        RaiseReady uses Anthropic&apos;s Claude models to read documents and run the Investor Room.
        To do this, the content of your uploaded documents, your startup profile and your answers in
        the Investor Room are sent to Anthropic for processing. We only send what is needed for the
        feature you are using, and we never include another user&apos;s data in your requests.
        Anthropic handles this data under its own commercial terms and privacy policy.
      </p>

      <h2>Who else processes your data</h2>
      <ul>
        <li>
          <strong>Supabase</strong> hosts our database, sign-in system and file storage.
        </li>
        <li>
          <strong>Vercel</strong> hosts the website and application.
        </li>
        <li>
          <strong>Paystack</strong> processes payments.
        </li>
      </ul>
      <p>
        Some of these providers may store or process data outside Nigeria. We don&apos;t sell your data
        or share it with investors, advertisers or other users.
      </p>

      <h2>How we protect it</h2>
      <p>
        Documents are kept in private storage and are only accessible through short-lived links
        created for your signed-in account. Database rules restrict each account to its own data. No
        system is perfectly secure, so please don&apos;t upload anything you are not comfortable
        sharing with the providers listed above.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your data while your account is open. When you delete a document, the file and its
        record are removed. When you delete your account, your profile, startups, documents,
        assessments, simulations, reports and payment records are permanently deleted. Usage records
        are kept for cost reporting but are no longer linked to you. We keep a log entry that the
        deletion happened, with the total you had paid us but no name, email or startup details. Any
        Pro subscription is cancelled with Paystack first. Paystack keeps its own payment records
        under its own privacy policy.
      </p>

      <h2>Your rights and how to delete your data</h2>
      <p>
        You can see and edit your startup profile in the app at any time. You can ask us for a copy of
        your data, ask us to correct it, or ask us to delete it. You can delete individual documents
        on the Documents page, and your whole account under Settings. For anything else, contact us
        at <ContactEmail />.
      </p>
      <p>
        If you are unhappy with how we handle your data, you can also complain to the Nigeria Data
        Protection Commission.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that matters, we&apos;ll update the date above and tell you
        in the app or by email.
      </p>
    </LegalPage>
  );
}
