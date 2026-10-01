/**
 * Readiness rubric (spec 6.2). Dimensions, weights and the concrete indicators
 * the model rates. Changing anything here that affects scores requires a new
 * RUBRIC_VERSION, so old and new assessments are never silently compared.
 */
export const RUBRIC_VERSION = "2026-10.v1";

export type IndicatorDef = { id: string; label: string; description: string };

export type DimensionDef = {
  id: string;
  name: string;
  /** Percentage weight; all weights sum to 100. */
  weight: number;
  /** Only scored once the founder has completed an Investor Room simulation. */
  requiresSimulation?: boolean;
  /** Investor persona best suited to practising this area. */
  practise: { persona: "seed_vc" | "angel" | "grant_evaluator"; focus: string };
  indicators: IndicatorDef[];
};

export const DIMENSIONS: DimensionDef[] = [
  {
    id: "problem",
    name: "Problem clarity",
    weight: 10,
    practise: { persona: "angel", focus: "the problem and who has it" },
    indicators: [
      { id: "problem_stated", label: "Problem stated specifically", description: "A specific, concrete problem is stated, not a broad theme." },
      { id: "problem_who", label: "Who has the problem", description: "Identifies who experiences the problem (segment, location, size of business or household)." },
      { id: "problem_evidence", label: "Evidence of pain", description: "Evidence the problem is real and painful: data, customer research, quotes, frequency or cost." },
      { id: "problem_quantified", label: "Problem quantified", description: "Puts a number on the problem's cost, frequency or scale." },
      { id: "problem_local", label: "Local context explained", description: "Explains why the problem exists in their market (infrastructure, regulation, behaviour)." },
    ],
  },
  {
    id: "solution",
    name: "Solution",
    weight: 10,
    practise: { persona: "angel", focus: "your product and why it wins" },
    indicators: [
      { id: "solution_described", label: "How it solves the problem", description: "Clearly explains how the product solves the stated problem." },
      { id: "solution_differentiation", label: "Better than alternatives", description: "Explains why it is better than current alternatives, including informal ones." },
      { id: "solution_stage", label: "Product stage stated", description: "States the product's stage (idea, prototype, MVP, live) and what exists today." },
      { id: "solution_validation", label: "Customer validation", description: "Shows customers use or want it: usage, pilots, feedback, waitlist, letters of intent." },
      { id: "solution_delivery", label: "How it is delivered", description: "Explains how the product works or is delivered (channels, technology, operations)." },
    ],
  },
  {
    id: "market",
    name: "Market opportunity",
    weight: 10,
    practise: { persona: "seed_vc", focus: "market size and growth" },
    indicators: [
      { id: "market_tam", label: "Total market stated", description: "States the total addressable market (TAM) with a figure." },
      { id: "market_sam_som", label: "Serviceable and obtainable market", description: "States SAM and/or SOM, narrowing to what they can realistically reach." },
      { id: "market_sources", label: "Market sources given", description: "Cites sources or methodology for market figures." },
      { id: "market_bottom_up", label: "Bottom-up sizing", description: "Sizes the market bottom-up (customers × price) rather than only top-down percentages." },
      { id: "market_why_now", label: "Why now", description: "Explains market growth or timing: why this opportunity exists now." },
      { id: "market_expansion", label: "Expansion path", description: "Describes a credible path beyond the first market or segment." },
    ],
  },
  {
    id: "traction",
    name: "Traction",
    weight: 15,
    practise: { persona: "seed_vc", focus: "traction and growth" },
    indicators: [
      { id: "traction_users", label: "Users or customers stated", description: "States how many users or customers they have." },
      { id: "traction_paying", label: "Paying customers", description: "States how many customers pay." },
      { id: "traction_revenue", label: "Revenue with period", description: "States revenue with its period (e.g. monthly, a specific month)." },
      { id: "traction_growth", label: "Growth rate", description: "States a growth rate or shows growth over time." },
      { id: "traction_retention", label: "Retention or engagement", description: "Gives retention, repeat usage, churn or engagement figures." },
      { id: "traction_milestones", label: "Milestones and partnerships", description: "Names concrete milestones: partnerships, pilots, contracts, licences, awards." },
    ],
  },
  {
    id: "business_model",
    name: "Business model",
    weight: 10,
    practise: { persona: "seed_vc", focus: "the business model and unit economics" },
    indicators: [
      { id: "model_revenue", label: "How it makes money", description: "Clearly states how the business makes money." },
      { id: "model_pricing", label: "Pricing stated", description: "States actual prices, fees or take rates." },
      { id: "model_unit_logic", label: "Profit per customer explained", description: "Explains margins or how each customer or transaction becomes profitable." },
      { id: "model_acquisition", label: "Customer acquisition channel", description: "Explains how customers are acquired and through which channels." },
      { id: "model_scalability", label: "Scales efficiently", description: "Explains why costs grow slower than revenue as the business scales." },
    ],
  },
  {
    id: "financials",
    name: "Financial readiness",
    weight: 15,
    practise: { persona: "seed_vc", focus: "financials and unit economics" },
    indicators: [
      { id: "fin_revenue_period", label: "Revenue stated with period", description: "Revenue is stated with its period and currency." },
      { id: "fin_gross_margin", label: "Gross margin stated", description: "States gross margin." },
      { id: "fin_burn", label: "Burn stated", description: "States monthly burn or operating costs." },
      { id: "fin_runway", label: "Runway stated", description: "States current runway in months." },
      { id: "fin_cac", label: "CAC stated", description: "States customer acquisition cost." },
      { id: "fin_assumptions", label: "Growth assumptions explained", description: "Explains the assumptions behind projections (growth, pricing, costs)." },
    ],
  },
  {
    id: "competition",
    name: "Competition / moat",
    weight: 10,
    practise: { persona: "seed_vc", focus: "competition and defensibility" },
    indicators: [
      { id: "comp_named", label: "Competitors named", description: "Names direct competitors and alternatives, including informal or offline ones." },
      { id: "comp_honest", label: "Honest comparison", description: "Compares fairly, acknowledging where competitors are strong." },
      { id: "comp_differentiation", label: "Clear differentiation", description: "States a specific reason customers choose them over competitors." },
      { id: "comp_moat", label: "Defensibility", description: "Names a moat that gets stronger over time: network effects, data, licences, distribution, switching costs." },
      { id: "comp_barriers", label: "Barriers to entry", description: "Explains what would stop a well-funded entrant (bank, telco, global player) from copying them." },
    ],
  },
  {
    id: "team",
    name: "Team",
    weight: 10,
    practise: { persona: "angel", focus: "you and your team" },
    indicators: [
      { id: "team_founders", label: "Founders and roles", description: "Names the founders and their roles." },
      { id: "team_experience", label: "Relevant experience", description: "Shows experience relevant to this problem or market." },
      { id: "team_commitment", label: "Full-time commitment", description: "States that founders work on the startup full-time." },
      { id: "team_gaps", label: "Gaps and hiring plan", description: "Acknowledges key gaps and how they will be filled." },
      { id: "team_support", label: "Advisors or board", description: "Names advisors, board members or notable backers." },
    ],
  },
  {
    id: "fundraising",
    name: "Fundraising strategy",
    weight: 5,
    practise: { persona: "seed_vc", focus: "your funding ask and use of funds" },
    indicators: [
      { id: "raise_amount", label: "Amount stated", description: "States how much they are raising." },
      { id: "raise_instrument", label: "Instrument stated", description: "States the instrument: equity, SAFE, convertible note, grant or debt." },
      { id: "raise_use_milestones", label: "Use of funds tied to milestones", description: "Breaks down use of funds and ties it to milestones the money will achieve." },
      { id: "raise_runway", label: "Runway from this round", description: "States how long the round will last." },
      { id: "raise_terms", label: "Valuation or terms", description: "States valuation, cap or key terms where relevant to the instrument." },
    ],
  },
  {
    id: "communication",
    name: "Communication / defence",
    weight: 5,
    requiresSimulation: true,
    practise: { persona: "seed_vc", focus: "handling tough questions" },
    indicators: [
      { id: "comm_clear", label: "Clear answers", description: "Answers questions directly and concisely." },
      { id: "comm_evidence", label: "Backs claims with evidence", description: "Supports claims with numbers and examples." },
      { id: "comm_consistent", label: "Consistent with documents", description: "Answers agree with the documents and earlier answers." },
      { id: "comm_objections", label: "Handles objections", description: "Responds to pushback calmly with substance." },
    ],
  },
];

export const RATINGS = ["met", "partial", "not_met", "not_applicable"] as const;
export type Rating = (typeof RATINGS)[number];

/** Points per rating. not_applicable is excluded from the dimension instead. */
export const RATING_POINTS: Record<Exclude<Rating, "not_applicable">, number> = {
  met: 2,
  partial: 1,
  not_met: 0,
};

export const BANDS = [
  { id: "not_ready", label: "Not ready", min: 0 },
  { id: "getting_there", label: "Getting there", min: 50 },
  { id: "nearly_ready", label: "Nearly ready", min: 70 },
  { id: "investor_ready", label: "Investor ready", min: 85 },
] as const;
export type BandId = (typeof BANDS)[number]["id"];

/** Dimensions scoring below this get "why it's weak / what investors ask / fix" feedback. */
export const WEAK_THRESHOLD = 70;

export function bandFor(score: number): (typeof BANDS)[number] {
  return [...BANDS].reverse().find((b) => score >= b.min) ?? BANDS[0];
}

export function dimensionById(id: string): DimensionDef | undefined {
  return DIMENSIONS.find((d) => d.id === id);
}

export const ALL_INDICATOR_IDS = DIMENSIONS.flatMap((d) => d.indicators.map((i) => i.id));
