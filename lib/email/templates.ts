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
