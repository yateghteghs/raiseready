import { describe, expect, it } from "vitest";

import {
  companySchema,
  firstStepWithError,
  fundraisingSchema,
  onboardingSchema,
  startupSchema,
  toFormValues,
  toStartupRow,
} from "@/lib/startups/schema";

const complete = {
  full_name: "Ada Obi",
  country: "Nigeria",
  name: "PayLink",
  website: "paylink.ng",
  industry: "Fintech",
  startup_country: "Nigeria",
  founding_year: "2022",
  stage: "seed",
  business_model: "1.5% per transaction",
  customers_count: "1,200",
  revenue_monthly: "₦4,500,000",
  revenue_currency: "NGN",
  growth_notes: "",
  raising: "yes",
  amount_seeking: "500000",
  seeking_currency: "USD",
  funding_type: "safe",
  previously_raised: "no",
  use_of_funds: "",
};

describe("onboarding schema", () => {
  it("parses a complete form submission", () => {
    const r = onboardingSchema.parse(complete);
    expect(r).toMatchObject({
      website: "https://paylink.ng",
      founding_year: 2022,
      customers_count: 1200,
      revenue_monthly: 4_500_000,
      raising: true,
      amount_seeking: 500_000,
      previously_raised: false,
      growth_notes: undefined,
    });
  });

  it("requires an amount when raising", () => {
    const r = fundraisingSchema.safeParse({ ...complete, amount_seeking: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["amount_seeking"]);
  });

  it("does not require an amount when not raising", () => {
    expect(fundraisingSchema.safeParse({ ...complete, raising: "no", amount_seeking: "" }).success).toBe(true);
  });

  it.each([
    ["future founding year", { founding_year: String(new Date().getFullYear() + 1) }],
    ["negative revenue", { revenue_monthly: "-5" }],
    ["fractional customer count", { customers_count: "1.5" }],
    ["unknown stage", { stage: "series_z" }],
    ["non-web website", { website: "ftp://files.example" }],
  ])("rejects %s", (_label, patch) => {
    expect(onboardingSchema.safeParse({ ...complete, ...patch }).success).toBe(false);
  });

  it("requires name, industry, market and stage", () => {
    const r = companySchema.safeParse({});
    expect(r.success).toBe(false);
    const fields = r.error!.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["name", "industry", "startup_country", "stage"]));
  });
});

describe("firstStepWithError", () => {
  it("finds the step that owns a field", () => {
    expect(firstStepWithError(["full_name"])).toBe(0);
    expect(firstStepWithError(["stage"])).toBe(1);
    expect(firstStepWithError(["revenue_monthly"])).toBe(2);
    expect(firstStepWithError(["use_of_funds", "stage"])).toBe(1);
    expect(firstStepWithError(["amount_seeking"])).toBe(3);
  });
});

describe("startup row mapping", () => {
  it("stores blanks as null and drops the amount when not raising", () => {
    const row = toStartupRow(startupSchema.parse({ ...complete, raising: "no" }));
    expect(row.amount_seeking).toBeNull();
    expect(row.growth_notes).toBeNull();
    expect(row.country).toBe("Nigeria");
  });

  it("round-trips through form values", () => {
    const row = toStartupRow(startupSchema.parse(complete));
    const now = new Date().toISOString();
    const values = toFormValues(
      { ...row, id: "s1", owner_id: "u1", created_at: now, updated_at: now } as never,
      { full_name: "Ada Obi", country: "Nigeria" },
    );
    expect(onboardingSchema.parse(values)).toEqual(onboardingSchema.parse(complete));
  });
});
