import { describe, expect, it } from "vitest";

import { partialStringField } from "@/lib/ai/partial-json";

describe("partialStringField", () => {
  const full = '{"next_action":"follow_up","investor_message":"You said \\"1,200\\".\\nWhich month?","evaluation":{}}';

  it("returns null before the field starts", () => {
    expect(partialStringField('{"next_action":"fol', "investor_message")).toBeNull();
  });

  it("decodes the complete value", () => {
    expect(partialStringField(full, "investor_message")).toBe('You said "1,200".\nWhich month?');
  });

  it("grows monotonically as more text arrives", () => {
    let previous = "";
    for (let n = 1; n <= full.length; n++) {
      const value = partialStringField(full.slice(0, n), "investor_message") ?? "";
      expect(value.startsWith(previous)).toBe(true);
      previous = value;
    }
    expect(previous).toBe('You said "1,200".\nWhich month?');
  });

  it("handles unicode escapes such as the naira sign", () => {
    expect(partialStringField('{"investor_message":"\\u20a65m"}', "investor_message")).toBe("₦5m");
  });
});
