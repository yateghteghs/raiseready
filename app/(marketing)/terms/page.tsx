import type { Metadata } from "next";
import Link from "next/link";

import { ContactEmail, LegalPage, Operator } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms are an agreement between you and <Operator /> (&ldquo;Index Prima&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;), which provides RaiseReady. They apply whenever you use
        RaiseReady, from anywhere. By creating an account or using RaiseReady, you agree to them. Please
        also read our <Link href="/privacy">privacy policy</Link>, which explains how we handle your
        data.
      </p>

      <h2>1. What RaiseReady is</h2>
      <p>
        RaiseReady helps founders prepare to raise money. It analyses your documents, gives a readiness
        assessment, lets you practise with AI investors in the Investor Room, and produces reports and
        pitch decks. It is a practice and preparation tool only:
      </p>
      <ul>
        <li>It is not investment, legal, financial, tax or accounting advice.</li>
        <li>The investors in the Investor Room are simulations, not real people or real investment offers.</li>
        <li>
          A good score or report does not mean anyone will invest in your startup, and we don&apos;t
          introduce you to investors.
        </li>
      </ul>

      <h2>2. AI output can be wrong</h2>
      <p>
        Assessments, feedback, red flags, reports and pitch decks are produced with AI. They may contain
        mistakes, miss things or misread your documents. You are responsible for checking anything
        before you rely on it or share it, especially numbers and claims you put in front of investors.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>You must be at least 18 years old and able to enter into a binding agreement.</li>
        <li>
          If you use RaiseReady for a company, you confirm you&apos;re allowed to act for it, and these
          terms also bind that company.
        </li>
        <li>Give accurate details, keep your password safe and don&apos;t share your account.</li>
        <li>
          You&apos;re responsible for what happens under your account. Tell us straight away if you think
          someone else has accessed it.
        </li>
      </ul>

      <h2>4. Your content</h2>
      <p>
        You keep ownership of everything you upload or enter, and of the reports and pitch decks
        RaiseReady creates for you. You give us permission to store, process and copy your content,
        including sending it to our AI provider, only to provide RaiseReady to you and keep it working,
        as described in the privacy policy. This permission ends when you delete the content or your
        account.
      </p>
      <p>
        Only upload material you have the right to use. Don&apos;t upload confidential information
        belonging to others unless you&apos;re allowed to share it.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>access or try to access other users&apos; data, or test, probe or break our security</li>
        <li>upload malware, or content that is unlawful, infringing or abusive</li>
        <li>use RaiseReady to create false or misleading material to deceive investors or anyone else</li>
        <li>overload, disrupt or reverse engineer the service, or get around usage limits</li>
        <li>copy, resell or give automated access to RaiseReady without our written permission</li>
        <li>use RaiseReady to build a competing product</li>
      </ul>

      <h2>6. Plans and payments</h2>
      <ul>
        <li>
          <strong>Prices.</strong> RaiseReady has a free plan, paid plans and one-off purchases such as
          simulation credits and pitch decks. Current prices and what each plan includes are on the{" "}
          <Link href="/pricing">pricing page</Link>.
        </li>
        <li>
          <strong>Currency.</strong> Payments are charged in US dollars or Nigerian naira, as shown
          at checkout. Amounts shown in other currencies are estimates only. Your bank
          or card provider may add currency conversion or other fees.
        </li>
        <li>
          <strong>Paystack.</strong> Payments are processed by Paystack. You pay Index Prima, and the
          charge may appear on your statement under that name.
        </li>
        <li>
          <strong>Subscriptions</strong> renew automatically each month, charged to the same card, until
          you cancel. You can cancel on the Billing page at any time. Your plan stays active until the
          end of the month you have paid for, and is not charged again.
        </li>
        <li>
          <strong>Upgrades.</strong> Moving from Pro to Pro Plus starts Pro Plus straight away and ends
          your Pro subscription. Unused Pro days are not refunded.
        </li>
        <li>
          <strong>Credits and decks</strong> you buy stay on your account while it is open. They have no
          cash value and are lost if you delete your account.
        </li>
        <li>
          <strong>Discounts and invites.</strong> Discount codes and invite rewards follow the
          conditions shown when you use them. They can&apos;t be exchanged for cash, and we may cancel
          them if they are misused.
        </li>
        <li>
          <strong>Price changes.</strong> We may change prices. A new price applies to new purchases.
          Existing subscriptions keep their price until you cancel.
        </li>
        <li>
          <strong>Taxes.</strong> Prices include any taxes we are required to charge, unless checkout
          says otherwise.
        </li>
      </ul>

      <h2>7. Refunds</h2>
      <p>
        If you were charged by mistake, charged twice, or a paid feature didn&apos;t work and we
        couldn&apos;t fix it, contact us within 14 days at <ContactEmail /> and we will refund you. We
        don&apos;t otherwise refund used credits, part-used months or features you have already used.
        This doesn&apos;t affect any refund rights you have under the consumer law of your country.
      </p>

      <h2>8. Teams</h2>
      <p>
        If you join a team through an accelerator, hub or programme, you get the plan that team
        provides for as long as the team is active, and its programme contact can see the progress
        information described in the privacy policy. You can leave a team at any time. When a team ends
        or you leave it, your account returns to your own plan.
      </p>

      <h2>9. Sharing reports</h2>
      <p>
        If you create a share link for a report, anyone with the link can read that report until it
        expires or you turn it off. You decide who to send it to, and you are responsible for sharing
        it.
      </p>

      <h2>10. Our service and intellectual property</h2>
      <p>
        RaiseReady, including its software, design, scoring rules, investor personas and brand, belongs
        to Index Prima. You may use it only as these terms allow. If you send us feedback or ideas, we
        may use them without owing you anything.
      </p>
      <p>
        We work to keep RaiseReady available and secure, but we can&apos;t promise it will always be
        available or error-free. We may change, add or remove features. If we remove a paid feature you
        rely on, we&apos;ll tell you in advance where we reasonably can.
      </p>

      <h2>11. Suspending or ending your use</h2>
      <p>
        You can stop using RaiseReady and delete your account at any time under Settings. We may
        suspend or close your account if you break these terms, misuse the service, fail to pay, or if
        the law requires it. Where it&apos;s appropriate, we&apos;ll tell you why and give you a chance to
        respond. If we close your account without a good reason under these terms, we&apos;ll refund any
        unused paid period.
      </p>

      <h2>12. Liability</h2>
      <p>
        RaiseReady is provided &ldquo;as is&rdquo;. To the extent the law allows:
      </p>
      <ul>
        <li>
          we are not responsible for fundraising outcomes, investment decisions, or decisions you make
          based on RaiseReady&apos;s output
        </li>
        <li>we are not liable for indirect or consequential losses, or for lost profits, funding or opportunities</li>
        <li>
          our total liability to you is limited to the amount you paid us in the 12 months before the
          claim, or US$50 if that is more
        </li>
      </ul>
      <p>
        Nothing in these terms limits liability that can&apos;t be limited by law, such as liability for
        fraud, or for death or personal injury caused by negligence.
      </p>
      <p>
        You agree to compensate Index Prima for losses caused by your breaking these terms or the law,
        for example by uploading material you have no right to use.
      </p>

      <h2>13. Changes to these terms</h2>
      <p>
        We may update these terms as RaiseReady changes. If a change matters, we&apos;ll update the date
        at the top and tell you in the app or by email at least 14 days before it takes effect. If you
        keep using RaiseReady after that, the new terms apply. If you don&apos;t agree, you can cancel and
        delete your account.
      </p>

      <h2>14. Governing law and disputes</h2>
      <p>
        These terms are governed by the laws of the Federal Republic of Nigeria. If you have a problem,
        please contact us first, and we will try to resolve it within 30 days. If we can&apos;t, the
        courts of Nigeria will decide the dispute. If you live outside Nigeria, you keep any protections
        and any right to go to your local courts that your country&apos;s consumer law gives you.
      </p>

      <h2>15. General</h2>
      <ul>
        <li>These terms and the privacy policy are the whole agreement between you and us about RaiseReady.</li>
        <li>If any part of these terms can&apos;t be enforced, the rest still applies.</li>
        <li>If we don&apos;t enforce a right straight away, we can still enforce it later.</li>
        <li>
          You can&apos;t transfer your rights under these terms to anyone else. We may transfer ours to a
          business that takes over RaiseReady.
        </li>
      </ul>

      <h2>16. Contact</h2>
      <p>
        Questions about these terms: <ContactEmail />.
      </p>
    </LegalPage>
  );
}
