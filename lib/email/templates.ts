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
