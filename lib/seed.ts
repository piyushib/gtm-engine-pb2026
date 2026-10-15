import {
  Assumptions,
  Channel,
  MOTION_IDS,
  MotionId,
  RetentionProfile,
} from "./types";

/**
 * Synthetic-but-defensible seed for a ~$32M ARR hybrid B2B SaaS running a
 * $1.2M/month GTM budget across PLG, sales-led, and AI-native channels.
 *
 * Every number here is an *assumption*, not a measurement. Swap this file for
 * a warehouse query and the rest of the engine is unchanged.
 */

/** Baseline retention by motion, before channel-quality adjustment. */
const MOTION_RETENTION_BASE: Record<MotionId, RetentionProfile> = {
  selfServe: {
    monthlyLogoChurn: 0.075,
    churnDecay: 0.055,
    minMonthlyChurn: 0.028,
    monthlyExpansion: 0.009,
    monthlyContraction: 0.005,
  },
  salesAssisted: {
    monthlyLogoChurn: 0.022,
    churnDecay: 0.06,
    minMonthlyChurn: 0.009,
    monthlyExpansion: 0.016,
    monthlyContraction: 0.006,
  },
  enterprise: {
    monthlyLogoChurn: 0.009,
    churnDecay: 0.07,
    minMonthlyChurn: 0.0035,
    monthlyExpansion: 0.022,
    monthlyContraction: 0.005,
  },
};

/**
 * Channels differ in buyer intent and fit, which shows up as retention, not
 * just CAC. A pushed outbound logo and an inbound AEO logo can have identical
 * CAC and still be worth wildly different amounts.
 */
interface RetentionQuality {
  churnMult: number;
  expansionMult: number;
}

function buildRetention(q: RetentionQuality): Record<MotionId, RetentionProfile> {
  const out = {} as Record<MotionId, RetentionProfile>;
  for (const motion of MOTION_IDS) {
    const base = MOTION_RETENTION_BASE[motion];
    out[motion] = {
      monthlyLogoChurn: base.monthlyLogoChurn * q.churnMult,
      churnDecay: base.churnDecay,
      minMonthlyChurn: base.minMonthlyChurn * q.churnMult,
      monthlyExpansion: base.monthlyExpansion * q.expansionMult,
      monthlyContraction: base.monthlyContraction * (2 - q.expansionMult),
    };
  }
  return out;
}

type ChannelSeed = Omit<Channel, "retention"> & { quality: RetentionQuality };

const SEEDS: ChannelSeed[] = [
  {
    id: "paid-search",
    name: "Paid Search",
    group: "Paid",
    isAgentic: false,
    blurb:
      "High-intent keyword capture. Fast feedback loop, but the cheapest inventory is already bought — incremental dollars buy progressively worse clicks.",
    spend: { media: 180_000, people: 18_000, content: 12_000, tooling: 8_000 },
    motionMix: { selfServe: 0.8, salesAssisted: 0.18, enterprise: 0.02 },
    saturation: { K: 72, h: 300_000 },
    funnel: { touchToLead: 0.031, leadToQualified: 0.34, qualifiedToWon: 0.21 },
    arpaMultiplier: 0.95,
    salesCycleMonths: 0.7,
    monthlyCompounding: 0,
    rampMonths: 1,
    quality: { churnMult: 1.05, expansionMult: 0.95 },
  },
  {
    id: "paid-social",
    name: "Paid Social",
    group: "Paid",
    isAgentic: false,
    blurb:
      "LinkedIn + Meta demand generation. Buys reach and brand recall rather than intent, so it underperforms on last-touch CAC and churns harder.",
    spend: { media: 120_000, people: 14_000, content: 22_000, tooling: 6_000 },
    motionMix: { selfServe: 0.62, salesAssisted: 0.32, enterprise: 0.06 },
    saturation: { K: 28, h: 330_000 },
    funnel: { touchToLead: 0.012, leadToQualified: 0.19, qualifiedToWon: 0.14 },
    arpaMultiplier: 0.9,
    salesCycleMonths: 1.6,
    monthlyCompounding: 0,
    rampMonths: 2,
    quality: { churnMult: 1.45, expansionMult: 0.85 },
  },
  {
    id: "seo-content",
    name: "SEO & Content",
    group: "Organic & AEO",
    isAgentic: false,
    blurb:
      "Owned organic surface. Slow to ramp and people-cost heavy, but each dollar builds a compounding asset instead of renting attention.",
    spend: { media: 0, people: 42_000, content: 58_000, tooling: 9_000 },
    motionMix: { selfServe: 0.72, salesAssisted: 0.24, enterprise: 0.04 },
    saturation: { K: 68, h: 165_000 },
    funnel: { touchToLead: 0.024, leadToQualified: 0.37, qualifiedToWon: 0.23 },
    arpaMultiplier: 1.0,
    salesCycleMonths: 1.2,
    monthlyCompounding: 0.022,
    rampMonths: 9,
    quality: { churnMult: 0.85, expansionMult: 1.05 },
  },
  {
    id: "aeo",
    name: "AEO / Answer Engines",
    group: "Organic & AEO",
    isAgentic: true,
    blurb:
      "Being the cited answer inside ChatGPT, Claude, Perplexity and AI Overviews. Exceptional intent and retention, but a hard volume ceiling — it cannot absorb much budget yet.",
    spend: { media: 0, people: 26_000, content: 34_000, tooling: 14_000 },
    motionMix: { selfServe: 0.45, salesAssisted: 0.42, enterprise: 0.13 },
    saturation: { K: 19, h: 70_000 },
    funnel: { touchToLead: 0.085, leadToQualified: 0.46, qualifiedToWon: 0.29 },
    arpaMultiplier: 1.12,
    salesCycleMonths: 0.9,
    monthlyCompounding: 0.035,
    rampMonths: 6,
    quality: { churnMult: 0.72, expansionMult: 1.18 },
  },
  {
    id: "agentic-outbound",
    name: "Agentic Outbound (AI SDR)",
    group: "Outbound",
    isAgentic: true,
    blurb:
      "AI-run research, sequencing and reply handling. Cost base shifts from headcount to inference, so volume is nearly free — but it is interruption demand, and it churns like it.",
    spend: { media: 0, people: 22_000, content: 8_000, tooling: 46_000 },
    motionMix: { selfServe: 0.08, salesAssisted: 0.62, enterprise: 0.3 },
    saturation: { K: 6, h: 150_000 },
    funnel: { touchToLead: 0.009, leadToQualified: 0.22, qualifiedToWon: 0.17 },
    arpaMultiplier: 0.88,
    salesCycleMonths: 2.4,
    monthlyCompounding: 0,
    rampMonths: 3,
    quality: { churnMult: 1.6, expansionMult: 0.9 },
  },
  {
    id: "human-outbound",
    name: "Human Outbound (SDR/AE)",
    group: "Outbound",
    isAgentic: false,
    blurb:
      "Named-account prospecting into the enterprise motion. Overwhelmingly a people cost, which makes it the channel most exposed to fully-loaded CAC accounting.",
    spend: { media: 0, people: 210_000, content: 10_000, tooling: 24_000 },
    motionMix: { selfServe: 0.02, salesAssisted: 0.4, enterprise: 0.58 },
    saturation: { K: 7.6, h: 260_000 },
    funnel: { touchToLead: 0.021, leadToQualified: 0.31, qualifiedToWon: 0.22 },
    arpaMultiplier: 1.0,
    salesCycleMonths: 4.1,
    monthlyCompounding: 0,
    rampMonths: 5,
    quality: { churnMult: 1.0, expansionMult: 1.1 },
  },
  {
    id: "partner-marketplace",
    name: "Partner & Agent Marketplaces",
    group: "Partner",
    isAgentic: true,
    blurb:
      "Cloud marketplaces, co-sell, and emerging agent/MCP directories. Borrowed trust shortens cycles and co-sold accounts expand hardest.",
    spend: { media: 18_000, people: 34_000, content: 10_000, tooling: 8_000 },
    motionMix: { selfServe: 0.18, salesAssisted: 0.48, enterprise: 0.34 },
    saturation: { K: 6.2, h: 110_000 },
    funnel: { touchToLead: 0.055, leadToQualified: 0.41, qualifiedToWon: 0.31 },
    arpaMultiplier: 1.05,
    salesCycleMonths: 2.2,
    monthlyCompounding: 0.014,
    rampMonths: 7,
    quality: { churnMult: 0.78, expansionMult: 1.22 },
  },
  {
    id: "community-events",
    name: "Community & Events",
    group: "Partner",
    isAgentic: false,
    blurb:
      "Field events, sponsorships and practitioner community. Attribution is genuinely murky and the ramp is long, but retention is top-quartile.",
    spend: { media: 46_000, people: 30_000, content: 18_000, tooling: 4_000 },
    motionMix: { selfServe: 0.16, salesAssisted: 0.52, enterprise: 0.32 },
    saturation: { K: 9, h: 150_000 },
    funnel: { touchToLead: 0.072, leadToQualified: 0.28, qualifiedToWon: 0.26 },
    arpaMultiplier: 1.0,
    salesCycleMonths: 3.3,
    monthlyCompounding: 0.012,
    rampMonths: 8,
    quality: { churnMult: 0.8, expansionMult: 1.12 },
  },
  {
    id: "lifecycle-plg",
    name: "Lifecycle & PLG Loops",
    group: "Lifecycle",
    isAgentic: false,
    blurb:
      "Onboarding, activation nudges, in-product invites and referral loops. Structurally the cheapest customers in the portfolio and the engine behind expansion.",
    spend: { media: 4_000, people: 20_000, content: 12_000, tooling: 12_000 },
    motionMix: { selfServe: 0.86, salesAssisted: 0.13, enterprise: 0.01 },
    saturation: { K: 78, h: 70_000 },
    funnel: { touchToLead: 0.14, leadToQualified: 0.52, qualifiedToWon: 0.34 },
    arpaMultiplier: 0.92,
    salesCycleMonths: 0.4,
    monthlyCompounding: 0.008,
    rampMonths: 2,
    quality: { churnMult: 0.9, expansionMult: 1.3 },
  },
];

export const SEED_CHANNELS: Channel[] = SEEDS.map(({ quality, ...rest }) => ({
  ...rest,
  retention: buildRetention(quality),
}));

export const SEED_ASSUMPTIONS: Assumptions = {
  monthlyBudget: 1_200_000,
  grossMargin: 0.82,
  discountRateAnnual: 0.12,
  ltvHorizonMonths: 36,
  salesEffortExponent: 0.8,
  motions: {
    selfServe: { arpa: 140, costToServe: 0.06 },
    salesAssisted: { arpa: 1_450, costToServe: 0.1 },
    enterprise: { arpa: 6_200, costToServe: 0.16 },
  },
};
