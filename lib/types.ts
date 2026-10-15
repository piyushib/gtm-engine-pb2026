// Domain model for the GTM unit-economics engine.
//
// The organizing idea: every marketing dollar is tagged with a cost *type*,
// routed into a *channel*, which converts it into customers across three
// *motions* (self-serve, sales-assisted, enterprise). Each motion has its own
// retention/expansion behaviour, so the same dollar produces different
// lifetime value depending on where it lands.

export type MotionId = "selfServe" | "salesAssisted" | "enterprise";

export const MOTION_IDS: MotionId[] = ["selfServe", "salesAssisted", "enterprise"];

export const MOTION_LABELS: Record<MotionId, string> = {
  selfServe: "Self-serve (PLG)",
  salesAssisted: "Sales-assisted",
  enterprise: "Enterprise",
};

export type ChannelGroup = "Paid" | "Organic & AEO" | "Outbound" | "Partner" | "Lifecycle";

/**
 * Fully-loaded cost stack. Keeping these separate is what lets us show
 * paid-only CAC (what ad platforms report) next to fully-loaded CAC (what the
 * board cares about).
 */
export interface CostStack {
  /** Working media: ad auctions, sponsorships, paid placements. */
  media: number;
  /** Allocated headcount comp: marketers, SDRs, AEs, solutions. */
  people: number;
  /** Creative + content production, agencies, design, video. */
  content: number;
  /** Platforms, data, enrichment, and LLM inference for agentic channels. */
  tooling: number;
}

export const COST_KEYS: (keyof CostStack)[] = ["media", "people", "content", "tooling"];

export const COST_LABELS: Record<keyof CostStack, string> = {
  media: "Media",
  people: "People",
  content: "Content",
  tooling: "Tooling & AI",
};

/**
 * Diminishing-returns response curve: customers = K * spend / (spend + h).
 *
 * K is the monthly ceiling the channel can ever deliver (market size bound),
 * h is the spend level at which the channel delivers half that ceiling.
 * The derivative gives marginal CAC, which is the only honest basis for
 * deciding where the *next* dollar should go.
 */
export interface SaturationCurve {
  K: number;
  h: number;
}

/**
 * Retention behaviour of a cohort. Churn starts at `monthlyLogoChurn` and
 * decays toward `minMonthlyChurn` as the cohort seasons (survivorship bias is
 * real and modelling it avoids wildly understated LTV).
 */
export interface RetentionProfile {
  monthlyLogoChurn: number;
  /** Fractional improvement in churn per month of tenure, 0-1. */
  churnDecay: number;
  minMonthlyChurn: number;
  /** Expansion on surviving revenue per month (seats, usage, upsell). */
  monthlyExpansion: number;
  /** Downgrades on surviving revenue per month. */
  monthlyContraction: number;
}

/** Stage conversion rates from first touch to closed-won. */
export interface Funnel {
  touchToLead: number;
  leadToQualified: number;
  qualifiedToWon: number;
}

export interface Channel {
  id: string;
  name: string;
  group: ChannelGroup;
  /** AI-native GTM surface (AEO, agentic outbound, agent marketplaces). */
  isAgentic: boolean;
  blurb: string;
  spend: CostStack;
  /** Share of acquired customers landing in each motion. Sums to 1. */
  motionMix: Record<MotionId, number>;
  saturation: SaturationCurve;
  funnel: Funnel;
  retention: Record<MotionId, RetentionProfile>;
  /** Channel ACV quality vs the motion baseline. 1.0 = baseline. */
  arpaMultiplier: number;
  /** Lag in months between spend and recognised revenue. */
  salesCycleMonths: number;
  /**
   * Compounding channels (SEO, AEO, community) accrue an owned asset: each
   * month of investment raises the ceiling K. Expressed as monthly lift.
   */
  monthlyCompounding: number;
  /** Months of sustained investment before the channel reaches steady state. */
  rampMonths: number;
}

export interface MotionBaseline {
  /** Monthly recurring revenue per account at baseline quality. */
  arpa: number;
  /** Variable cost to serve, as a share of revenue (support, infra, CSM). */
  costToServe: number;
}

export interface Assumptions {
  /** Total monthly GTM budget to allocate across channels. */
  monthlyBudget: number;
  /** Blended product gross margin before cost-to-serve differences. */
  grossMargin: number;
  /** Annual discount rate applied to future gross profit. */
  discountRateAnnual: number;
  /** Horizon over which LTV is recognised. 36 months is the defensible default. */
  ltvHorizonMonths: number;
  /**
   * How a channel's spend is split across its motions, as an exponent on ARPA.
   *
   * 0 = spend follows customer count (every motion in a channel has the same
   * CAC, which understates enterprise acquisition cost). 1 = spend follows
   * revenue (every motion has the same CAC:ARPA ratio, which erases the
   * difference between motions). Values in between say "bigger deals cost more
   * to win, but sub-linearly" — the honest middle, and the single assumption
   * self-serve economics are most sensitive to.
   */
  salesEffortExponent: number;
  motions: Record<MotionId, MotionBaseline>;
}

// ---------------------------------------------------------------------------
// Computed output
// ---------------------------------------------------------------------------

export interface CohortPoint {
  month: number;
  /** Share of the original logos still active (customer-weighted). */
  logoSurvival: number;
  /**
   * Revenue retained from surviving logos at their original price point —
   * dollar-weighted survival, before contraction or expansion. This is the
   * correct base for decomposing NRR, since logoSurvival is customer-weighted
   * and higher-ARPA motions retain differently.
   */
  dollarSurvival: number;
  /** Revenue retained vs cohort month 0, net of churn/expansion/contraction. */
  netDollarRetention: number;
  /** Same, excluding expansion — the floor the business cannot fall below. */
  grossDollarRetention: number;
  /** Cumulative discounted gross profit per acquired customer. */
  cumGrossProfit: number;
}

export interface MotionEconomics {
  motion: MotionId;
  customers: number;
  arpa: number;
  newMrr: number;
  cac: number;
  ltv: number;
  ltvToCac: number;
  paybackMonths: number | null;
  nrr12: number;
  grr12: number;
  logoRetention12: number;
  cohort: CohortPoint[];
}

export interface ChannelEconomics {
  channel: Channel;
  totalSpend: number;
  spendShare: number;
  customers: number;
  /** Fully-loaded CAC: every dollar in the cost stack. */
  cac: number;
  /** Paid-only CAC: working media alone, i.e. what the ad platform shows. */
  cacPaidOnly: number;
  /** Cost of acquiring one *more* customer at the current spend level. */
  marginalCac: number;
  /** How far into the saturation curve this channel is pushed, 0-1. */
  saturationLevel: number;
  arpa: number;
  newMrr: number;
  newArr: number;
  ltv: number;
  ltvToCac: number;
  paybackMonths: number | null;
  nrr12: number;
  grr12: number;
  logoRetention12: number;
  /** Discounted gross profit returned per $1 of fully-loaded spend. */
  returnPerDollar: number;
  /** Return on the *next* dollar — the allocation signal. */
  marginalReturnPerDollar: number;
  grossProfit12: number;
  grossProfit36: number;
  cohort: CohortPoint[];
  motions: MotionEconomics[];
}

export interface PortfolioEconomics {
  totalSpend: number;
  customers: number;
  cac: number;
  cacPaidOnly: number;
  arpa: number;
  newMrr: number;
  newArr: number;
  ltv: number;
  ltvToCac: number;
  paybackMonths: number | null;
  nrr12: number;
  grr12: number;
  logoRetention12: number;
  returnPerDollar: number;
  grossProfit12: number;
  grossProfit36: number;
  /** Net new ARR per dollar of GTM spend, annualised. */
  magicNumber: number;
  cohort: CohortPoint[];
  channels: ChannelEconomics[];
}

export interface AllocationMove {
  channelId: string;
  channelName: string;
  current: number;
  recommended: number;
  delta: number;
  marginalReturnBefore: number;
  marginalReturnAfter: number;
}

export interface OptimizedAllocation {
  moves: AllocationMove[];
  projected: { returnPerDollar: number; customers: number; newArr: number };
  baseline: { returnPerDollar: number; customers: number; newArr: number };
}
