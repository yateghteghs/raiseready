import type { Difficulty, Persona } from "@/lib/supabase/database.types";

/**
 * Investor personas (spec 6.3). Each persona works through its own ordered
 * subset of the 10 rounds, with emphasis weights that tell the investor where
 * to dig harder, and a tone. Difficulty changes depth and pushback, never
 * factual fairness.
 */

export const ROUNDS: Record<number, string> = {
  1: "Overview",
  2: "Problem",
  3: "Market",
  4: "Traction",
  5: "Business model",
  6: "Competition",
  7: "Financials",
  8: "Funding ask & use of funds",
  9: "Objections",
  10: "Closing challenge",
};

export type PersonaConfig = {
  id: Persona;
  name: string;
  /** One-line description for the setup screen. */
  summary: string;
  /** Rounds in the order this persona runs them. */
  rounds: number[];
  /** Persona-specific names for rounds, where they differ. */
  roundTitles?: Partial<Record<number, string>>;
  /** Emphasis per round (1 = normal); higher means probe harder there. */
  emphasis: Partial<Record<number, number>>;
  focus: string;
  tone: string;
  opening: (startupName: string) => string;
};

export const PERSONAS: Record<Persona, PersonaConfig> = {
  seed_vc: {
    id: "seed_vc",
    name: "Seed VC",
    summary: "Market size, growth, moat, unit economics and how big this can get.",
    rounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    emphasis: { 3: 1.5, 4: 1.5, 6: 1.3, 7: 1.5, 2: 0.8 },
    focus: "market size, growth rate, defensibility (moat), unit economics and scalability",
    tone: "Direct, numbers-driven and time-conscious. Interested in whether this can become a very large company.",
    opening: (name) =>
      `Thanks for making the time. I've read through ${name}'s materials. Let's start simple: in two minutes, what does ${name} do, who is it for, and why now?`,
  },
  angel: {
    id: "angel",
    name: "Angel investor",
    summary: "You as a founder, your product, early traction and how far each naira goes.",
    rounds: [1, 2, 4, 5, 6, 7, 8, 9, 10],
    emphasis: { 1: 1.3, 4: 1.3, 7: 1.2, 3: 0.7 },
    focus: "the founder and team, the product, early traction and capital efficiency",
    tone: "Warm but curious, invests personal money, wants to understand the founder and how carefully money is spent.",
    opening: (name) =>
      `Good to meet you. Before we get into numbers, tell me about yourself and how you came to start ${name}. What are you building?`,
  },
  grant_evaluator: {
    id: "grant_evaluator",
    name: "Grant evaluator",
    summary: "The problem, evidence of impact, your implementation plan and sustainability.",
    rounds: [1, 2, 4, 5, 7, 8, 9, 10],
    roundTitles: {
      4: "Impact evidence",
      5: "Implementation",
      7: "Sustainability",
      8: "Budget & use of funds",
    },
    emphasis: { 2: 1.5, 4: 1.5, 5: 1.3, 7: 1.2 },
    focus: "the problem, measurable impact evidence, implementation capacity and long-term sustainability",
    tone: "Methodical and fair, follows a scoring rubric, wants evidence and realistic plans rather than ambition.",
    opening: (name) =>
      `Welcome, and thank you for applying. I'll be asking about ${name}'s problem, impact, implementation and sustainability. To begin, please summarise the project and the problem it addresses.`,
  },
};

export const DIFFICULTIES: Record<
  Difficulty,
  { label: string; summary: string; maxFollowUps: number; behaviour: string }
> = {
  friendly: {
    label: "Friendly",
    summary: "Encouraging, at most one follow-up per topic.",
    maxFollowUps: 1,
    behaviour:
      "Encouraging and patient. Ask one clear question at a time. Follow up only when an answer is missing something important. Acknowledge good answers briefly.",
  },
  analytical: {
    label: "Analytical",
    summary: "Probes for numbers and evidence, up to two follow-ups.",
    maxFollowUps: 2,
    behaviour:
      "Neutral and precise. Ask for numbers, sources and specifics. Follow up when answers are vague or unsupported.",
  },
  tough: {
    label: "Tough",
    summary: "Pushes back hard on weak answers, up to two follow-ups.",
    maxFollowUps: 2,
    behaviour:
      "Sceptical and demanding but always fair and professional. Challenge weak or vague answers directly, test assumptions, and press on gaps. Never rude, never unfair about facts.",
  },
};

export function roundTitle(persona: Persona, round: number): string {
  return PERSONAS[persona].roundTitles?.[round] ?? ROUNDS[round];
}
