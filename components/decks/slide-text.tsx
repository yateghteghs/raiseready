import { PLACEHOLDER } from "@/lib/ai/schemas/deck";

/** Text with "[Add: ...]" placeholders highlighted, so founders see what to fill in. */
export function SlideText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(PLACEHOLDER)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <mark key={m.index} className="rounded bg-amber-100 px-1 font-medium text-amber-800">
        {m[0]}
      </mark>,
    );
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}
