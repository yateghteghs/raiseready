import { describe, expect, it } from "vitest";

import { deckBuildAccess, deckUnlockAccess, rewriteAccess, type DeckUsage } from "@/lib/billing/entitlements";

const usage = (over: Partial<DeckUsage> = {}): DeckUsage => ({ proActive: false, deckCredits: 0, proDecksThisMonth: 0, previewsUsed: 0, ...over });

describe("deck builder rules", () => {
  it("gives everyone one free preview, then asks them to pay", () => {
    expect(deckBuildAccess(usage())).toEqual({ ok: true, via: "preview" });
    expect(deckBuildAccess(usage({ previewsUsed: 1 }))).toMatchObject({ ok: false, upgrade: true });
    expect(deckUnlockAccess(usage())).toMatchObject({ ok: false });
  });

  it("gives Pro three full decks a month, then uses bought decks", () => {
    expect(deckBuildAccess(usage({ proActive: true, proDecksThisMonth: 2 }))).toEqual({ ok: true, via: "pro" });
    expect(deckBuildAccess(usage({ proActive: true, proDecksThisMonth: 3, previewsUsed: 1 }))).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/used the 3 decks/),
    });
    expect(deckUnlockAccess(usage({ proActive: true, proDecksThisMonth: 3, deckCredits: 1 }))).toEqual({ ok: true, via: "credit" });
  });

  it("uses a bought deck before the free preview", () => {
    expect(deckBuildAccess(usage({ deckCredits: 1 }))).toEqual({ ok: true, via: "credit" });
  });

  it("limits AI rewrites by how the deck was paid for", () => {
    expect(rewriteAccess({ access: "preview", rewrites_used: 0 })).toMatchObject({ ok: false });
    expect(rewriteAccess({ access: "credit", rewrites_used: 1 })).toMatchObject({ ok: true });
    expect(rewriteAccess({ access: "credit", rewrites_used: 2 })).toMatchObject({ ok: false, upgrade: false });
    expect(rewriteAccess({ access: "pro", rewrites_used: 29 })).toMatchObject({ ok: true });
    expect(rewriteAccess({ access: "pro", rewrites_used: 30 })).toMatchObject({ ok: false });
  });
});
