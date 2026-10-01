import { z } from "zod";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalText = (max: number) => z.preprocess(blank, z.string().trim().max(max, { error: `Use at most ${max} characters.` }).optional());

export const SHOWCASE_KINDS = [
  { value: "logo", label: "Startup logo", hint: "A startup that practised with RaiseReady. Shown in the logo strip on the home page." },
  { value: "testimonial", label: "Testimonial", hint: "A quote from a founder. Shown on the home page and the Testimonials page." },
  { value: "partner", label: "Partner", hint: "An organisation you work with. Shown on the Partners page." },
] as const;

export const showcaseSchema = z
  .object({
    kind: z.enum(["logo", "testimonial", "partner"], { error: "Choose a type." }),
    name: z.string().trim().min(1, { error: "Enter the company or organisation name." }).max(120),
    quote: optionalText(600),
    person_name: optionalText(120),
    person_title: optionalText(120),
    url: z.preprocess(blank, z.url({ protocol: /^https$/, error: "Use a full https:// web address." }).max(300).optional()),
    position: z.preprocess((v) => (blank(v) === undefined ? 0 : v), z.coerce.number().int().min(0).max(999)),
    permission_confirmed: z.preprocess((v) => v === "on", z.boolean()),
    published: z.preprocess((v) => v === "on", z.boolean()),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "testimonial" && !v.quote) ctx.addIssue({ code: "custom", path: ["quote"], message: "Add the quote." });
    if (v.kind === "testimonial" && !v.person_name) ctx.addIssue({ code: "custom", path: ["person_name"], message: "Add who said it." });
    if (v.published && !v.permission_confirmed) {
      ctx.addIssue({ code: "custom", path: ["permission_confirmed"], message: "Confirm you have permission before publishing." });
    }
  });

export type ShowcaseInput = z.infer<typeof showcaseSchema>;
