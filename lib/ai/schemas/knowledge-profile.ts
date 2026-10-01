import { z } from "zod";

/**
 * Startup Knowledge Profile (spec 6.1): the structured facts extracted from a
 * founder's documents. Every number and statement carries where it came from,
 * so later contradictions can be traced. Anything not in the documents is null.
 */

export const sourceSchema = z.object({
  source_document_id: z.string().describe("The id attribute of the <founder_document> it came from."),
  page_or_sheet: z.string().describe('Where in that document, e.g. "page 4" or "sheet Revenue, row 12".'),
  quote: z.string().describe("Short verbatim quote from the document supporting the value (under 200 characters)."),
});

export const sourcedNumberSchema = z.object({
  value: z.number().describe("The number as stated. Percentages as percent values: 45 for 45%."),
  unit: z
    .string()
    .describe('ISO currency code for money (e.g. "NGN", "USD"), or a unit such as "%", "users", "customers", "months".'),
  period: z
    .string()
    .nullable()
    .describe('Time period the figure covers, e.g. "monthly", "March 2026", "FY2025". Null if not stated.'),
  ...sourceSchema.shape,
});

export const sourcedTextSchema = z.object({
  summary: z.string().describe("What the documents say, in one to three plain sentences. No embellishment."),
  sources: z.array(sourceSchema).describe("At least one source."),
});

const text = sourcedTextSchema.nullable();
const number = sourcedNumberSchema.nullable();

export const knowledgeProfileSchema = z.object({
  problem: text,
  solution: text,
  product: text,
  target_customer: text,
  market: z.object({
    tam: number,
    sam: number,
    som: number,
    stated_sources: z
      .string()
      .nullable()
      .describe("Where the founder says the market figures come from (report, study, own estimate). Null if not stated."),
  }),
  business_model: text,
  pricing: text,
  revenue: z.array(sourcedNumberSchema).describe("Every revenue figure stated, each with its period and currency."),
  traction: z.object({
    users: number,
    paying_customers: number,
    growth: z.array(sourcedNumberSchema).describe("Growth rates or growth figures stated."),
    notes: text,
  }),
  unit_economics: z.object({
    cac: number,
    ltv: number,
    gross_margin: number,
    burn: number,
    runway: number,
  }),
  competition: text,
  moat: text,
  team: text,
  funding_ask: number,
  use_of_funds: text,
  valuation: number,
  risks: text,
  africa_context: z.object({
    markets: z.array(z.string()).describe("Countries or cities the startup operates in or targets."),
    fx_exposure: text,
    regulatory_notes: text,
    informal_market_dynamics: text,
  }),
});

export type KnowledgeProfile = z.infer<typeof knowledgeProfileSchema>;
export type SourcedNumber = z.infer<typeof sourcedNumberSchema>;
export type SourcedText = z.infer<typeof sourcedTextSchema>;

type Source = z.infer<typeof sourceSchema>;

/** Every source reference in a profile, with the field path it belongs to. */
export function collectSources(value: unknown, path = ""): { path: string; source: Source }[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => collectSources(v, `${path}[${i}]`));
  if (value === null || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const own =
    typeof record.source_document_id === "string" ? [{ path, source: record as unknown as Source }] : [];
  return [
    ...own,
    ...Object.entries(record).flatMap(([k, v]) => collectSources(v, path ? `${path}.${k}` : k)),
  ];
}

/**
 * Checks what the schema can't: every source must point at a document we
 * actually supplied, and every text field must cite at least one source.
 * Returns human-readable problems (empty when valid).
 */
export function checkProfileSources(profile: KnowledgeProfile, documentIds: string[]): string[] {
  const allowed = new Set(documentIds);
  const problems: string[] = [];
  for (const { path, source } of collectSources(profile)) {
    if (!allowed.has(source.source_document_id)) {
      problems.push(`${path}: source_document_id "${source.source_document_id}" is not one of the supplied documents.`);
    }
    if (!source.quote.trim()) problems.push(`${path}: quote is empty.`);
  }
  const checkText = (path: string, t: SourcedText | null) => {
    if (t && t.sources.length === 0) problems.push(`${path}: has a summary but no sources. Cite one or set it to null.`);
  };
  for (const [k, v] of Object.entries(profile)) {
    if (v && typeof v === "object" && "summary" in v) checkText(k, v as SourcedText);
  }
  checkText("traction.notes", profile.traction.notes);
  for (const k of ["fx_exposure", "regulatory_notes", "informal_market_dynamics"] as const) {
    checkText(`africa_context.${k}`, profile.africa_context[k]);
  }
  return problems;
}
