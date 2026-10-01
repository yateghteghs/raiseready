import type { Metadata } from "next";
import Link from "next/link";

import { ContactEmail, LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms apply when you use RaiseReady. By creating an account you agree to them.
      </p>

      <h2>What RaiseReady is</h2>
      <p>
        RaiseReady is a practice and preparation tool. It gives AI-generated assessments, simulated
        investor questions and feedback. It is not investment, legal, financial or tax advice, and it
        is not a real investor. A good score does not mean anyone will invest in your startup.
      </p>

      <h2>AI output can be wrong</h2>
      <p>
        Assessments, red flags and feedback are produced with the help of AI and may contain mistakes,
        miss things or misread your documents. Check anything important yourself before relying on it.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must give accurate details and keep your password safe.</li>
        <li>You are responsible for what happens under your account.</li>
        <li>You must be at least 18, or have the permission of someone who can agree to these terms for you.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You keep ownership of the documents and information you upload. You give us permission to
        store and process them, including sending them to our AI provider, only to provide the service
        to you, as described in our <Link href="/privacy">privacy policy</Link>. Only upload material
        you have the right to share.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Don&apos;t try to access other users&apos; data or interfere with the service.</li>
        <li>Don&apos;t upload malicious files or content that is unlawful.</li>
        <li>Don&apos;t use the service to generate misleading material to deceive investors.</li>
        <li>Don&apos;t resell or automate access to the service without our permission.</li>
      </ul>

      <h2>Plans and payments</h2>
      <p>
        Paid plans and credits are priced in Nigerian naira and processed by Paystack. Pro renews
        monthly until you cancel; cancelling stops the next renewal. Usage limits for each plan are
        shown on the <Link href="/pricing">pricing page</Link>. Refunds are handled case by case;
        contact us if something went wrong.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using RaiseReady and delete your account at any time. We may suspend accounts
        that break these terms.
      </p>

      <h2>Liability</h2>
      <p>
        We provide RaiseReady as it is and can&apos;t promise it will always be available or error-free.
        To the extent the law allows, we are not responsible for fundraising outcomes or decisions you
        make based on the service.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <ContactEmail />.
      </p>
    </LegalPage>
  );
}
