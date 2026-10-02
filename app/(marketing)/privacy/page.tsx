import type { Metadata } from "next";
import Link from "next/link";

import { ContactEmail, LegalPage, Operator } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        This policy explains what personal data RaiseReady collects, why, who it is shared with, how
        long it is kept and the choices you have. RaiseReady is used by founders across Africa, so we
        follow the Nigeria Data Protection Act 2023 and respect the data protection laws of the
        countries our users live in, such as Kenya&apos;s Data Protection Act 2019, South Africa&apos;s
        Protection of Personal Information Act (POPIA), Ghana&apos;s Data Protection Act 2012 and
        Egypt&apos;s Personal Data Protection Law. Where your country&apos;s law gives you more
        protection, you keep it.
      </p>

      <h2>1. Who we are</h2>
      <p>
        RaiseReady is a product of <Operator />. Index Prima decides how your personal data is used and
        is responsible for it (the &ldquo;data controller&rdquo;). &ldquo;We&rdquo;, &ldquo;us&rdquo; and
        &ldquo;our&rdquo; in this policy mean Index Prima. You can contact us about anything in this
        policy at <ContactEmail />.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address, the country you&apos;re based in,
          and your password, which is stored encrypted so that we can never read it. If you add one, a
          profile picture.
        </li>
        <li>
          <strong>Startup profile:</strong> what you tell us about your startup, such as its name,
          stage, industry, revenue, customers and fundraising plans, and its logo if you add one.
        </li>
        <li>
          <strong>Documents you upload:</strong> your pitch deck and, if you add them, your financial
          model and business plan.
        </li>
        <li>
          <strong>What RaiseReady creates for you:</strong> the profile extracted from your documents,
          readiness assessments, Investor Room conversations and the answers you give, red flags,
          reports, and pitch decks, including your edits and the changes you ask for.
        </li>
        <li>
          <strong>Payment records:</strong> what you bought, the price, the currency, any discount and
          the payment status. Card and bank details are entered on Paystack&apos;s pages. We never
          receive or store them.
        </li>
        <li>
          <strong>Usage records:</strong> when AI features were used and how much processing they took,
          so we can control costs and prevent abuse. These records don&apos;t contain your documents or
          answers.
        </li>
        <li>
          <strong>Sign-in and activity records:</strong> when you sign in, failed sign-in attempts on
          your account, the type of browser and device (for example &ldquo;Chrome on Android&rdquo;) and
          the days you used the app. We use them to keep accounts secure and to understand how
          RaiseReady is used.
        </li>
        <li>
          <strong>Error reports:</strong> if something goes wrong while you use the site, what failed
          and on which page, so we can fix it.
        </li>
        <li>
          <strong>Invites and discounts:</strong> if you joined through another founder&apos;s invite
          link, who invited you, so they can receive their reward, and any discount codes you use.
        </li>
        <li>
          <strong>Teams:</strong> if you join a team through an accelerator, hub or programme, which
          team you belong to. If your organisation asks us about Teams, the details in its enquiry.
        </li>
        <li>
          <strong>Messages:</strong> notifications the RaiseReady team sends you in the app, and whether
          you have read them.
        </li>
        <li>
          <strong>Account status:</strong> if our staff suspend or close an account, when this happened
          and the reason they recorded.
        </li>
      </ul>
      <p>
        We don&apos;t record your precise location. To show prices in the right currency, we use the
        country in your profile or, if you&apos;re not signed in, the country your internet connection
        appears to come from. We don&apos;t store that country.
      </p>

      <h2>3. Why we use it, and our legal basis</h2>
      <ul>
        <li>
          <strong>To provide RaiseReady to you</strong> (performing our contract with you): your account,
          analysing your documents, assessments, the Investor Room, reports, pitch decks, payments and
          support.
        </li>
        <li>
          <strong>To keep RaiseReady secure and working</strong> (our legitimate interests): sign-in
          records, error reports, preventing abuse and fraud, and controlling AI costs.
        </li>
        <li>
          <strong>To improve RaiseReady</strong> (our legitimate interests): understanding which
          features are used and where founders get stuck, using combined figures that don&apos;t
          identify you.
        </li>
        <li>
          <strong>To meet legal obligations</strong>, such as responding to lawful requests from
          authorities.
        </li>
        <li>
          <strong>With your consent</strong> where we ask for it, for example when you choose to join a
          team or share a report. You can withdraw consent at any time.
        </li>
      </ul>
      <p>
        We don&apos;t sell your data, we don&apos;t show you advertising, and we never share your
        documents or results with investors. RaiseReady doesn&apos;t make decisions about you that have
        legal or similarly significant effects: scores and feedback are practice tools for you alone.
      </p>

      <h2>4. AI processing</h2>
      <p>
        RaiseReady uses Claude, an AI model made by Anthropic, to read your documents, run the Investor
        Room, write reports and build pitch decks. To do this, the content of your documents, your
        startup profile, your Investor Room answers and your pitch deck requests are sent to Anthropic
        for processing. We send only what the feature you are using needs, and never another
        user&apos;s data. Under its commercial terms, Anthropic does not use data sent through its API
        to train its models. Your profile picture and company logo are never sent to Anthropic.
      </p>

      <h2>5. Who we share it with</h2>
      <p>We use these service providers to run RaiseReady. Each handles your data only to provide its service to us:</p>
      <ul>
        <li>
          <strong>Supabase:</strong> database, sign-in and file storage.
        </li>
        <li>
          <strong>Vercel:</strong> hosting of the website and app.
        </li>
        <li>
          <strong>Anthropic:</strong> AI processing, as described above.
        </li>
        <li>
          <strong>Paystack:</strong> payments. Paystack processes your payment details under its own
          privacy policy.
        </li>
        <li>
          <strong>Our email provider:</strong> sending account emails such as sign-up confirmations and
          password resets.
        </li>
      </ul>
      <p>We also share data:</p>
      <ul>
        <li>
          <strong>With your team&apos;s programme contact</strong>, if you join a team: your name, your
          startup&apos;s name, your readiness score, how many practice meetings you have held and when
          you were last active. They can&apos;t see your documents, answers or reports. You can leave a
          team at any time under Settings.
        </li>
        <li>
          <strong>With anyone who has a share link</strong>, if you create one for a report. They can
          read that report until the link expires or you turn it off. We count how often the link is
          opened, not who opens it.
        </li>
        <li>
          <strong>When the law requires it</strong>, or to protect the rights, safety or property of our
          users, the public or Index Prima.
        </li>
        <li>
          <strong>If Index Prima&apos;s business changes hands</strong>, with the new owner, who must
          keep protecting your data as this policy describes.
        </li>
      </ul>

      <h2>6. International transfers</h2>
      <p>
        Our providers store and process data in data centres outside your country, including in the
        United States and the European Union. When we transfer your data, we rely on the safeguards
        that data protection laws allow, such as the providers&apos; contractual commitments to protect
        personal data.
      </p>

      <h2>7. How we protect it</h2>
      <p>
        Data is encrypted in transit. Documents, profile pictures and logos are kept in private storage
        and can only be opened through short-lived links created for your signed-in account. Database
        rules restrict each account to its own data. Staff access is limited by role, and staff actions are recorded.
        No system is perfectly secure. If a data breach is likely to put you at risk, we will tell you
        and the relevant regulator as the law requires.
      </p>

      <h2>8. How long we keep it</h2>
      <ul>
        <li>Most of your data is kept for as long as your account is open.</li>
        <li>Sign-in records, activity records and error reports are deleted after 90 days.</li>
        <li>When you delete a document, the file and its record are removed straight away.</li>
        <li>
          When you delete your account, your profile, startups, documents, assessments, Investor Room
          sessions, reports, pitch decks and payment records are permanently deleted, and any
          subscription is cancelled first. Usage records are kept for cost reporting but are no longer
          linked to you. We keep a record that the deletion happened, with the total you had paid, but
          no name, email address or startup details. Paystack keeps its own payment records under its
          own policy.
        </li>
      </ul>

      <h2>9. Cookies</h2>
      <p>RaiseReady uses only a few small cookies, and none for advertising or tracking across other websites:</p>
      <ul>
        <li>
          <strong>Sign-in cookies</strong> keep you signed in. They are essential, and they are removed
          when you log out.
        </li>
        <li>
          <strong>Language</strong> (<code>rr_locale</code>) and <strong>currency</strong>{" "}
          (<code>rr_currency</code>) remember your choice for a year, if you make one.
        </li>
        <li>
          <strong>Invite</strong> (<code>rr_ref</code>) remembers, for 30 days, that you arrived through
          another founder&apos;s invite link, so the right founder gets the reward.
        </li>
      </ul>

      <h2>10. Your rights</h2>
      <p>Depending on where you live, you can:</p>
      <ul>
        <li>get a copy of your personal data, including in a format you can take elsewhere</li>
        <li>correct data that is wrong or incomplete</li>
        <li>delete your data</li>
        <li>object to, or ask us to restrict, how we use it</li>
        <li>withdraw consent you have given</li>
        <li>complain to a data protection regulator</li>
      </ul>
      <p>
        You can edit your profile and startup in the app, delete documents on the Documents page and
        delete your whole account under Settings. For any other request, email <ContactEmail />. We
        will reply within 30 days and may ask you to confirm your identity first.
      </p>
      <p>
        If you&apos;re unhappy with how we handle your data, please tell us first so we can put it
        right. You can also complain to the regulator in your country, for example the Nigeria Data
        Protection Commission, the Office of the Data Protection Commissioner in Kenya, the Information
        Regulator in South Africa or the Data Protection Commission in Ghana.
      </p>

      <h2>11. Age</h2>
      <p>
        RaiseReady is for founders aged 18 or over. We don&apos;t knowingly collect data from anyone
        younger. If you believe someone under 18 has an account, contact us and we will delete it.
      </p>

      <h2>12. Changes to this policy</h2>
      <p>
        If we change this policy in a way that matters, we&apos;ll update the date at the top and tell
        you in the app or by email before the change takes effect. See also our{" "}
        <Link href="/terms">terms of service</Link>.
      </p>
    </LegalPage>
  );
}
