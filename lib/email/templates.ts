import { SITE } from "@/lib/site";

type Built = { subject: string; text: string; html: string };

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A simple, readable email: paragraphs plus one button. Plain text is always sent too. */
function layout(paragraphs: string[], button?: { label: string; href: string }, after: string[] = []): string {
  const para = (list: string[]) => list.map((p) => `<p style="margin:0 0 16px">${escape(p)}</p>`).join("");
  const body = para(paragraphs);
  const cta = button
    ? `<p style="margin:24px 0"><a href="${escape(button.href)}" style="background:#0b6b47;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escape(button.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#555">Or paste this link into your browser: <br><span style="word-break:break-all">${escape(button.href)}</span></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f7f6;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#fff">
<p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#0b6b47">${escape(SITE.name)}</p>
${body}${cta}${para(after)}
<p style="margin:32px 0 0;font-size:12px;color:#777">${escape(SITE.name)} is a product of ${escape(SITE.company.name)}.</p>
</div></body></html>`;
}

export function staffInviteEmail(input: { name: string; role: string; link: string }): Built {
  const intro = `Hi ${input.name},`;
  const what = `You've been added to the ${SITE.name} team as ${input.role}. Open the link below to choose your password; you'll go straight to the admin area.`;
  const note = "The link works once and expires after a while. If it has expired, ask a super admin for a new one.";
  return {
    subject: `You've been invited to ${SITE.name} admin`,
    text: `${intro}\n\n${what}\n\n${input.link}\n\n${note}`,
    html: layout([intro, what], { label: "Choose your password", href: input.link }, [note]),
  };
}

export function staffSignInEmail(input: { link: string }): Built {
  const what = `Here is a new sign-in link for ${SITE.name} admin. Open it to set or change your password.`;
  const note = "The link works once and expires after a while. If you didn't ask for it, you can ignore this email.";
  return {
    subject: `Your ${SITE.name} admin sign-in link`,
    text: `${what}\n\n${input.link}\n\n${note}`,
    html: layout([what], { label: "Sign in", href: input.link }, [note]),
  };
}

export function testEmail(input: { sentBy: string }): Built {
  const what = `This is a test email from ${SITE.name}, sent from the admin area by ${input.sentBy}. If you can read it, email sending through Mailtrap works.`;
  return { subject: `${SITE.name} test email`, text: what, html: layout([what]) };
}

/** Account emails sent for Supabase Auth (through the Send Email hook). */
export function accountEmail(
  input:
    | { kind: "confirm" | "reset" | "signin" | "email_change"; name?: string; link: string }
    | { kind: "code"; name?: string; code: string },
): Built {
  const hello = input.name ? `Hi ${input.name},` : "Hi,";
  const ignore = "If you didn't ask for this, you can ignore this email.";
  switch (input.kind) {
    case "confirm": {
      const what = `Welcome to ${SITE.name}. Confirm your email address to activate your account and set up your startup.`;
      return {
        subject: `Confirm your ${SITE.name} account`,
        text: `${hello}\n\n${what}\n\n${input.link}\n\n${ignore}`,
        html: layout([hello, what], { label: "Confirm my email", href: input.link }, [ignore]),
      };
    }
    case "reset": {
      const what = `We received a request to reset your ${SITE.name} password. Open the link below to choose a new one.`;
      return {
        subject: `Reset your ${SITE.name} password`,
        text: `${hello}\n\n${what}\n\n${input.link}\n\n${ignore}`,
        html: layout([hello, what], { label: "Choose a new password", href: input.link }, [ignore]),
      };
    }
    case "signin": {
      const what = `Here is your link to sign in to ${SITE.name}.`;
      return {
        subject: `Your ${SITE.name} sign-in link`,
        text: `${hello}\n\n${what}\n\n${input.link}\n\n${ignore}`,
        html: layout([hello, what], { label: "Sign in", href: input.link }, [ignore]),
      };
    }
    case "email_change": {
      const what = `Confirm this new email address for your ${SITE.name} account.`;
      return {
        subject: `Confirm your new ${SITE.name} email`,
        text: `${hello}\n\n${what}\n\n${input.link}\n\n${ignore}`,
        html: layout([hello, what], { label: "Confirm new email", href: input.link }, [ignore]),
      };
    }
    case "code": {
      const what = `Your ${SITE.name} verification code is ${input.code}.`;
      return { subject: `Your ${SITE.name} verification code`, text: `${hello}\n\n${what}\n\n${ignore}`, html: layout([hello, what], undefined, [ignore]) };
    }
  }
}

/** Sent once, right after a founder confirms their email, from Mhenuter. Replies come to a real inbox. */
export function welcomeEmail(input: { name?: string; appUrl: string }): Built {
  const first = input.name?.trim().split(/\s+/)[0];
  const hello = first ? `Hi ${first},` : "Hi,";
  const intro = `I'm Mhenuter from ${SITE.name}. Welcome, and thank you for joining. ${SITE.name} helps you find the weak spots in your pitch before investors do.`;
  const steps = [
    "1. Upload your pitch deck. Your financial model and business plan are optional, but they make the feedback sharper.",
    "2. Get your readiness score across 10 areas, with what to fix first.",
    "3. Practise in the Investor Room with an AI investor who asks follow-ups and spots contradictions.",
    "4. Download your report and practise again until the hard questions feel easy.",
  ];
  const reply = "If anything is unclear, or you have an investor meeting coming up, just reply to this email. I read every reply.";
  const signOff = `Mhenuter\n${SITE.name}`;
  const link = `${input.appUrl.replace(/\/+$/, "")}/app`;
  return {
    subject: `Welcome to ${SITE.name}`,
    text: [hello, intro, "Here's how to get the most from it:", ...steps, link, reply, signOff].join("\n\n"),
    html: layout([hello, intro, "Here's how to get the most from it:", ...steps], { label: "Start with your pitch deck", href: link }, [reply, "Mhenuter", SITE.name]),
  };
}

const greet = (name?: string) => (name?.trim() ? `Hi ${name.trim().split(/\s+/)[0]},` : "Hi,");
const url = (appUrl: string, path: string) => `${appUrl.replace(/\/+$/, "")}${path}`;

/** Receipt for a successful payment (first purchase or renewal). */
export function receiptEmail(input: { name?: string; item: string; amount: string; date: string; reference: string; renewal: boolean; appUrl: string }): Built {
  const hello = greet(input.name);
  const what = input.renewal
    ? `Your ${input.item} subscription has renewed. Thank you for staying with ${SITE.name}.`
    : `Thank you for your payment. ${input.item} is now on your account.`;
  const details = [`Item: ${input.item}`, `Amount: ${input.amount}`, `Date: ${input.date}`, `Reference: ${input.reference}`];
  const note = `Payments are processed by Paystack and appear on your statement as ${SITE.company.name}. Keep this email as your receipt.`;
  const link = url(input.appUrl, "/app/billing");
  return {
    subject: input.renewal ? `Your ${SITE.name} ${input.item} renewal receipt` : `Your ${SITE.name} receipt`,
    text: [hello, what, details.join("\n"), note, `Billing: ${link}`].join("\n\n"),
    html: layout([hello, what, ...details], { label: "View billing", href: link }, [note]),
  };
}

/** Paystack couldn't charge a renewal. */
export function renewalFailedEmail(input: { name?: string; plan: string; appUrl: string }): Built {
  const hello = greet(input.name);
  const what = `We couldn't charge your card for your ${input.plan} renewal. Paystack will try again, but to keep ${input.plan} without interruption, check your card or update it from the Billing page.`;
  const link = url(input.appUrl, "/app/billing");
  return {
    subject: `Action needed: your ${SITE.name} ${input.plan} payment didn't go through`,
    text: [hello, what, link].join("\n\n"),
    html: layout([hello, what], { label: "Update payment details", href: link }),
  };
}

/** A subscription ended and the founder is back on the free plan. */
export function planEndedEmail(input: { name?: string; plan: string; appUrl: string }): Built {
  const hello = greet(input.name);
  const what = `Your ${input.plan} plan has ended, so your account is now on the free plan. Your startup profile, documents, assessments and reports are all still there.`;
  const next = `You can subscribe again or buy credits for individual practice sessions at any time from the Billing page.`;
  const link = url(input.appUrl, "/app/billing");
  return {
    subject: `Your ${SITE.name} ${input.plan} plan has ended`,
    text: [hello, what, next, link].join("\n\n"),
    html: layout([hello, what, next], { label: "See plans", href: link }),
  };
}

/** The founder has just used their last practice session (from Mhenuter). */
export function outOfPracticeEmail(input: { name?: string; paid: boolean; plan: string; appUrl: string }): Built {
  const hello = greet(input.name);
  const what = input.paid
    ? `You've just used the last Investor Room session included in ${input.plan} this month. That's a lot of practice; well done.`
    : "You've just used your free Investor Room session. I hope it showed you which questions to prepare for.";
  const options = input.paid
    ? "To keep practising before your allowance resets next month, you can buy a pack of credits for any investor and difficulty."
    : "To keep practising, you can buy a pack of credits for any investor and difficulty, or upgrade to Pro for sessions every month.";
  const reply = "If you have an investor meeting coming up and need help deciding, just reply to this email.";
  const link = url(input.appUrl, "/app/billing");
  return {
    subject: input.paid ? `You've used this month's ${input.plan} sessions` : "You've used your free practice session",
    text: [hello, what, options, link, reply, `Mhenuter\n${SITE.name}`].join("\n\n"),
    html: layout([hello, what, options], { label: "Keep practising", href: link }, [reply, "Mhenuter", SITE.name]),
  };
}

/** Security notice after the password was changed. */
export function passwordChangedEmail(input: { name?: string; appUrl: string }): Built {
  const hello = greet(input.name);
  const what = `The password for your ${SITE.name} account was just changed.`;
  const warn = "If this wasn't you, reset your password straight away using the link below, and reply to let us know.";
  const link = url(input.appUrl, "/forgot-password");
  return {
    subject: `Your ${SITE.name} password was changed`,
    text: [hello, what, warn, link].join("\n\n"),
    html: layout([hello, what, warn], { label: "Reset my password", href: link }),
  };
}

/** Staff suspended, reactivated or closed the account. */
export function accountStatusEmail(input: { name?: string; status: "suspended" | "reactivated" | "terminated"; reason?: string | null; appUrl: string }): Built {
  const hello = greet(input.name);
  const reason = input.reason?.trim() ? `Reason: ${input.reason.trim()}` : null;
  if (input.status === "reactivated") {
    const what = `Your ${SITE.name} account has been reactivated. You can sign in again, and everything is as you left it.`;
    const link = url(input.appUrl, "/login");
    return { subject: `Your ${SITE.name} account is active again`, text: [hello, what, link].join("\n\n"), html: layout([hello, what], { label: "Sign in", href: link }) };
  }
  const what =
    input.status === "suspended"
      ? `Your ${SITE.name} account has been suspended, so you can't sign in for now. Your data is kept.`
      : `Your ${SITE.name} account has been closed and can no longer be used. Any subscription has been cancelled.`;
  const contact = "If you think this is a mistake, reply to this email or contact us through the website.";
  const body = [hello, what, ...(reason ? [reason] : []), contact];
  return {
    subject: input.status === "suspended" ? `Your ${SITE.name} account has been suspended` : `Your ${SITE.name} account has been closed`,
    text: body.join("\n\n"),
    html: layout(body),
  };
}

/** Confirmation that an account and its data were deleted. */
export function accountDeletedEmail(input: { name?: string }): Built {
  const hello = greet(input.name);
  const what = `Your ${SITE.name} account has been deleted, along with your startup profile, documents, assessments, practice sessions, reports and pitch decks. Any subscription was cancelled first.`;
  const bye = `Thank you for trying ${SITE.name}. You're welcome back any time.`;
  return { subject: `Your ${SITE.name} account has been deleted`, text: [hello, what, bye].join("\n\n"), html: layout([hello, what, bye]) };
}
