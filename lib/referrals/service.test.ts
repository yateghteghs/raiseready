import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb } from "../../test/fake-supabase";

const fake = createFakeDb();
const db = fake.tables;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));

const { ensureReferralCode, isReferralCode, linkReferral, referralStats } = await import("@/lib/referrals/service");

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.profiles = [
    { id: "a", referral_code: null, referred_by: null },
    { id: "b", referral_code: null, referred_by: null },
  ];
  db.referral_rewards = [];
});

describe("referrals", () => {
  it("creates a readable code once and keeps it", async () => {
    const code = await ensureReferralCode("a");
    expect(isReferralCode(code)).toBe(true);
    expect(code).not.toMatch(/[01OI]/);
    expect(await ensureReferralCode("a")).toBe(code);
  });

  it("links a new founder to the inviter, never to themselves, and only once", async () => {
    const code = await ensureReferralCode("a");
    await linkReferral("b", code);
    expect(db.profiles[1].referred_by).toBe("a");
    await linkReferral("a", code);
    expect(db.profiles[0].referred_by).toBeNull();
    const other = await ensureReferralCode("b");
    db.profiles.push({ id: "c", referral_code: null, referred_by: "a" });
    await linkReferral("c", other);
    expect(db.profiles[2].referred_by).toBe("a");
    await linkReferral("b", "not-a-code");
  });

  it("counts invites and earned credits", async () => {
    db.profiles[1].referred_by = "a";
    db.referral_rewards = [{ referrer_id: "a", referred_id: "b", credits: 2 }];
    expect(await referralStats("a")).toEqual({ joined: 1, paid: 1, creditsEarned: 2 });
  });
});
