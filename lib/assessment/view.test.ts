import { describe, expect, it } from "vitest";

import { recommendedSimulation, type AssessmentView } from "@/lib/assessment/view";

const view = (weaknesses: { dimension_id: string; name: string; score: number }[]) => ({ weaknesses }) as unknown as AssessmentView;

describe("recommended Investor Room session", () => {
  it("targets the weakest area, gentler when it scores low", () => {
    expect(recommendedSimulation(view([{ dimension_id: "problem", name: "Problem", score: 40 }]))).toMatchObject({
      personaId: "angel",
      difficultyId: "friendly",
      persona: "Angel",
      difficulty: "Friendly",
      reason: "Problem",
    });
    expect(recommendedSimulation(view([{ dimension_id: "problem", name: "Problem", score: 60 }]))).toMatchObject({ difficultyId: "analytical" });
  });

  it("has no specific recommendation without weaknesses", () => {
    expect(recommendedSimulation(view([]))).toBeNull();
  });
});
