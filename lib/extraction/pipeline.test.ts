import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { isRunning, selectDocumentsForExtraction, STALE_PROCESSING_MS } = await import("@/lib/extraction/pipeline");

const doc = (id: string, kind: string, created: string, status = "uploaded", updated = created) =>
  ({ id, kind, created_at: created, updated_at: updated, status }) as never;

describe("selectDocumentsForExtraction", () => {
  it("uses the newest document of each kind", () => {
    const chosen = selectDocumentsForExtraction([
      doc("old-deck", "pitch_deck", "2026-01-01T00:00:00Z"),
      doc("new-deck", "pitch_deck", "2026-02-01T00:00:00Z"),
      doc("model", "financial_model", "2026-01-15T00:00:00Z"),
    ]);
    expect(chosen.map((d: { id: string }) => d.id).sort()).toEqual(["model", "new-deck"]);
  });
});

describe("isRunning", () => {
  const now = Date.parse("2026-03-01T12:00:00Z");
  it("is true while a document is processing", () => {
    expect(isRunning([doc("a", "pitch_deck", "x", "processing", new Date(now - 60_000).toISOString())], now)).toBe(true);
  });
  it("treats very old processing runs as dead", () => {
    const stale = new Date(now - STALE_PROCESSING_MS - 1).toISOString();
    expect(isRunning([doc("a", "pitch_deck", "x", "processing", stale)], now)).toBe(false);
  });
});
