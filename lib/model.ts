import {
  AllocationMove,
  Assumptions,
  Channel,
  ChannelEconomics,
  CohortPoint,
  CostStack,
  COST_KEYS,
  MOTION_IDS,
  MotionEconomics,
  MotionId,
  OptimizedAllocation,
  PortfolioEconomics,
  RetentionProfile,
  SaturationCurve,
} from "./types";

export function stackTotal(stack: CostStack): number {
  return COST_KEYS.reduce((sum, key) => sum + (stack[key] || 0), 0);
}

/** Scale a cost stack to a new total, preserving its internal composition. */
export function scaleStack(stack: CostStack, newTotal: number): CostStack {
  const current = stackTotal(stack);
  if (current <= 0) {
    return { media: newTotal, people: 0, content: 0, tooling: 0 };
  }
  const factor = newTotal / current;
  return {
    media: stack.media * factor,
    people: stack.people * factor,
    content: stack.content * factor,
    tooling: stack.tooling * factor,
  };
}

// ---------------------------------------------------------------------------
// Response curve
// ---------------------------------------------------------------------------

/** customers = K * spend / (spend + h) */
export function customersFromSpend(curve: SaturationCurve, spend: number): number {
  if (spend <= 0) return 0;
  return (curve.K * spend) / (spend + curve.h);
}

/** dCustomers/dSpend = K*h / (spend + h)^2 */
export function marginalCustomersPerDollar(curve: SaturationCurve, spend: number): number {
  const denom = (spend + curve.h) ** 2;
  if (denom <= 0) return 0;
  return (curve.K * curve.h) / denom;
}

/** Cost of the next incremental customer at the current spend level. */
export function marginalCac(curve: SaturationCurve, spend: number): number {
  const slope = marginalCustomersPerDollar(curve, spend);
  return slope > 0 ? 1 / slope : Infinity;
}

/** Share of the channel's theoretical ceiling already captured, 0-1. */
export function saturationLevel(curve: SaturationCurve, spend: number): number {
  if (spend <= 0) return 0;
  return spend / (spend + curve.h);
}

/**
 * Compounding channels build an owned asset: sustained investment raises the
 * ceiling itself. Used for the forward-looking ceiling projection.
 */
export function projectedCeiling(channel: Channel, months: number): number {
  return channel.saturation.K * (1 + channel.monthlyCompounding) ** months;
}

// ---------------------------------------------------------------------------
// Cohort mechanics
// ---------------------------------------------------------------------------

/** Gross logo churn in a given month of tenure, decaying with seasoning. */
function churnAtMonth(profile: RetentionProfile, month: number): number {
  if (month <= 0) return 0;
  const decayed = profile.monthlyLogoChurn * (1 - profile.churnDecay) ** (month - 1);
  return Math.min(1, Math.max(profile.minMonthlyChurn, decayed));
}

/**
 * A single acquisition stream: one motion within one channel. Modelling at this
 * grain lets us aggregate real dollars upward rather than averaging ratios,
 * which is what keeps portfolio NRR honest.
 */
interface Stream {
  customers: number;
  arpa: number;
  grossMarginEff: number;
  /** Share of logos surviving at month t. */
  survival: number[];
  /** Revenue per surviving account vs month 0, incl. expansion/contraction. */
  revenueIndex: number[];
  /** Same, excluding expansion. */
  grossRevenueIndex: number[];
  /** Cumulative discounted gross profit per acquired customer at month t. */
  cumGrossProfit: number[];
}

function buildStream(
  customers: number,
  arpa: number,
  grossMarginEff: number,
  profile: RetentionProfile,
  horizon: number,
  monthlyDiscount: number
): Stream {
  const survival: number[] = [1];
  const revenueIndex: number[] = [1];
  const grossRevenueIndex: number[] = [1];
  const cumGrossProfit: number[] = [arpa * grossMarginEff];

  for (let t = 1; t <= horizon; t++) {
    const retained = survival[t - 1] * (1 - churnAtMonth(profile, t));
    survival.push(retained);
    revenueIndex.push(
      revenueIndex[t - 1] * (1 + profile.monthlyExpansion - profile.monthlyContraction)
    );
    grossRevenueIndex.push(grossRevenueIndex[t - 1] * (1 - profile.monthlyContraction));
    const grossProfit = arpa * retained * revenueIndex[t] * grossMarginEff;
    cumGrossProfit.push(cumGrossProfit[t - 1] + grossProfit / (1 + monthlyDiscount) ** t);
  }

  return {
    customers,
    arpa,
    grossMarginEff,
    survival,
    revenueIndex,
    grossRevenueIndex,
    cumGrossProfit,
  };
}

/**
 * Aggregate streams into a dollar-weighted cohort. Retention is computed from
 * summed dollars and logos, never from averaged percentages.
 */
function aggregateCohort(streams: Stream[], horizon: number): CohortPoint[] {
  const logos0 = streams.reduce((s, x) => s + x.customers, 0);
  const rev0 = streams.reduce((s, x) => s + x.customers * x.arpa, 0);
  const points: CohortPoint[] = [];

  for (let t = 0; t <= horizon; t++) {
    let logos = 0;
    let rev = 0;
    let revGross = 0;
    let revSurvived = 0;
    let gp = 0;
    for (const s of streams) {
      logos += s.customers * s.survival[t];
      rev += s.customers * s.arpa * s.survival[t] * s.revenueIndex[t];
      revGross += s.customers * s.arpa * s.survival[t] * s.grossRevenueIndex[t];
      revSurvived += s.customers * s.arpa * s.survival[t];
      gp += s.customers * s.cumGrossProfit[t];
    }
    points.push({
      month: t,
      logoSurvival: logos0 > 0 ? logos / logos0 : 0,
      dollarSurvival: rev0 > 0 ? revSurvived / rev0 : 0,
      netDollarRetention: rev0 > 0 ? rev / rev0 : 0,
      grossDollarRetention: rev0 > 0 ? revGross / rev0 : 0,
      cumGrossProfit: logos0 > 0 ? gp / logos0 : 0,
    });
  }
  return points;
}

/**
 * Months until cumulative discounted gross profit per customer covers CAC.
 * Interpolated within the crossing month; null if never recovered in horizon.
 */
function paybackMonths(cohort: CohortPoint[], cac: number): number | null {
  if (!Number.isFinite(cac) || cac <= 0) return 0;
  for (let t = 0; t < cohort.length; t++) {
    if (cohort[t].cumGrossProfit >= cac) {
      if (t === 0) return 0;
      const prev = cohort[t - 1].cumGrossProfit;
      const gained = cohort[t].cumGrossProfit - prev;
      const fraction = gained > 0 ? (cac - prev) / gained : 0;
      return t - 1 + fraction;
    }
  }
  return null;
}

function atMonth(cohort: CohortPoint[], month: number): CohortPoint {
  return cohort[Math.min(month, cohort.length - 1)];
}

// ---------------------------------------------------------------------------
// Channel economics
// ---------------------------------------------------------------------------

export function computeChannel(
  channel: Channel,
  assumptions: Assumptions,
  portfolioSpend: number
): ChannelEconomics {
  const horizon = assumptions.ltvHorizonMonths;
  const monthlyDiscount = (1 + assumptions.discountRateAnnual) ** (1 / 12) - 1;
  const totalSpend = stackTotal(channel.spend);
  const customers = customersFromSpend(channel.saturation, totalSpend);

  // Distribute spend across motions by effort-weighted volume.
  const perMotion = MOTION_IDS.map((motion) => {
    const motionCustomers = customers * channel.motionMix[motion];
    const baseline = assumptions.motions[motion];
    const arpa = baseline.arpa * channel.arpaMultiplier;
    const effort = motionCustomers * arpa ** assumptions.salesEffortExponent;
    return { motion, motionCustomers, arpa, effort, costToServe: baseline.costToServe };
  });
  const effortTotal = perMotion.reduce((s, m) => s + m.effort, 0);

  const streams: Stream[] = [];
  const motions: MotionEconomics[] = perMotion.map((m) => {
    const grossMarginEff = assumptions.grossMargin - m.costToServe;
    const stream = buildStream(
      m.motionCustomers,
      m.arpa,
      grossMarginEff,
      channel.retention[m.motion],
      horizon,
      monthlyDiscount
    );
    streams.push(stream);

    const motionSpend = effortTotal > 0 ? totalSpend * (m.effort / effortTotal) : 0;
    const cac = m.motionCustomers > 0 ? motionSpend / m.motionCustomers : Infinity;
    const cohort = aggregateCohort([stream], horizon);
    const ltv = atMonth(cohort, horizon).cumGrossProfit;

    return {
      motion: m.motion,
      customers: m.motionCustomers,
      arpa: m.arpa,
      newMrr: m.motionCustomers * m.arpa,
      cac,
      ltv,
      ltvToCac: cac > 0 && Number.isFinite(cac) ? ltv / cac : 0,
      paybackMonths: paybackMonths(cohort, cac),
      nrr12: atMonth(cohort, 12).netDollarRetention,
      grr12: atMonth(cohort, 12).grossDollarRetention,
      logoRetention12: atMonth(cohort, 12).logoSurvival,
      cohort,
    };
  });

  const cohort = aggregateCohort(streams, horizon);
  const newMrr = streams.reduce((s, x) => s + x.customers * x.arpa, 0);
  const arpa = customers > 0 ? newMrr / customers : 0;
  const cac = customers > 0 ? totalSpend / customers : Infinity;
  const ltv = atMonth(cohort, horizon).cumGrossProfit;
  const mCac = marginalCac(channel.saturation, totalSpend);
  const grossProfit12 = atMonth(cohort, 12).cumGrossProfit * customers;
  const grossProfit36 = atMonth(cohort, 36).cumGrossProfit * customers;

  return {
    channel,
    totalSpend,
    spendShare: portfolioSpend > 0 ? totalSpend / portfolioSpend : 0,
    customers,
    cac,
    cacPaidOnly: customers > 0 ? channel.spend.media / customers : 0,
    marginalCac: mCac,
    saturationLevel: saturationLevel(channel.saturation, totalSpend),
    arpa,
    newMrr,
    newArr: newMrr * 12,
    ltv,
    ltvToCac: Number.isFinite(cac) && cac > 0 ? ltv / cac : 0,
    paybackMonths: paybackMonths(cohort, cac),
    nrr12: atMonth(cohort, 12).netDollarRetention,
    grr12: atMonth(cohort, 12).grossDollarRetention,
    logoRetention12: atMonth(cohort, 12).logoSurvival,
    returnPerDollar: totalSpend > 0 ? grossProfit12 / totalSpend : 0,
    marginalReturnPerDollar: Number.isFinite(mCac) && mCac > 0 ? ltv / mCac : 0,
    grossProfit12,
    grossProfit36,
    cohort,
    motions,
  };
}

export function computePortfolio(
  channels: Channel[],
  assumptions: Assumptions
): PortfolioEconomics {
  const totalSpend = channels.reduce((s, c) => s + stackTotal(c.spend), 0);
  const horizon = assumptions.ltvHorizonMonths;
  const monthlyDiscount = (1 + assumptions.discountRateAnnual) ** (1 / 12) - 1;
  const channelEcon = channels.map((c) => computeChannel(c, assumptions, totalSpend));

  // Rebuild streams across the whole portfolio so retention stays dollar-weighted.
  const streams: Stream[] = [];
  for (const c of channels) {
    const spend = stackTotal(c.spend);
    const customers = customersFromSpend(c.saturation, spend);
    for (const motion of MOTION_IDS) {
      const baseline = assumptions.motions[motion];
      streams.push(
        buildStream(
          customers * c.motionMix[motion],
          baseline.arpa * c.arpaMultiplier,
          assumptions.grossMargin - baseline.costToServe,
          c.retention[motion],
          horizon,
          monthlyDiscount
        )
      );
    }
  }

  const cohort = aggregateCohort(streams, horizon);
  const customers = channelEcon.reduce((s, c) => s + c.customers, 0);
  const newMrr = channelEcon.reduce((s, c) => s + c.newMrr, 0);
  const paidMedia = channels.reduce((s, c) => s + c.spend.media, 0);
  const cac = customers > 0 ? totalSpend / customers : Infinity;
  const ltv = atMonth(cohort, horizon).cumGrossProfit;
  const grossProfit12 = atMonth(cohort, 12).cumGrossProfit * customers;
  const grossProfit36 = atMonth(cohort, 36).cumGrossProfit * customers;

  return {
    totalSpend,
    customers,
    cac,
    cacPaidOnly: customers > 0 ? paidMedia / customers : 0,
    arpa: customers > 0 ? newMrr / customers : 0,
    newMrr,
    newArr: newMrr * 12,
    ltv,
    ltvToCac: Number.isFinite(cac) && cac > 0 ? ltv / cac : 0,
    paybackMonths: paybackMonths(cohort, cac),
    nrr12: atMonth(cohort, 12).netDollarRetention,
    grr12: atMonth(cohort, 12).grossDollarRetention,
    logoRetention12: atMonth(cohort, 12).logoSurvival,
    returnPerDollar: totalSpend > 0 ? grossProfit12 / totalSpend : 0,
    grossProfit12,
    grossProfit36,
    magicNumber: totalSpend > 0 ? (newMrr * 12) / totalSpend : 0,
    cohort,
    channels: channelEcon,
  };
}

// ---------------------------------------------------------------------------
// Allocation
// ---------------------------------------------------------------------------

/**
 * Greedy marginal-return allocation: hand out the budget in small increments,
 * each time to whichever channel currently returns the most lifetime gross
 * profit per incremental dollar. At the optimum, marginal returns equalise —
 * the textbook condition that is almost never true of a real budget.
 *
 * Bounds keep the answer operationally sane: no channel is zeroed out or asked
 * to absorb an implausible multiple of its current spend overnight.
 */
export function optimizeAllocation(
  channels: Channel[],
  assumptions: Assumptions,
  budget: number,
  opts: { minShareOfCurrent?: number; maxShareOfCurrent?: number; steps?: number } = {}
): OptimizedAllocation {
  const minShare = opts.minShareOfCurrent ?? 0.4;
  const maxShare = opts.maxShareOfCurrent ?? 2.0;
  const steps = opts.steps ?? 600;

  const base = channels.map((c) => {
    const spend = stackTotal(c.spend);
    const econ = computeChannel(c, assumptions, budget);
    return {
      channel: c,
      current: spend,
      min: spend * minShare,
      max: spend * maxShare,
      ltv: econ.ltv,
      alloc: spend * minShare,
    };
  });

  const floor = base.reduce((s, b) => s + b.min, 0);
  let remaining = Math.max(0, budget - floor);
  const increment = remaining / steps;

  if (increment > 0) {
    for (let i = 0; i < steps; i++) {
      let best = -1;
      let bestReturn = -Infinity;
      for (let j = 0; j < base.length; j++) {
        const b = base[j];
        if (b.alloc + increment > b.max) continue;
        // Average return over the increment, not the point derivative — avoids
        // overshooting into the flat part of a steep curve.
        const gained =
          customersFromSpend(b.channel.saturation, b.alloc + increment) -
          customersFromSpend(b.channel.saturation, b.alloc);
        const ret = (gained * b.ltv) / increment;
        if (ret > bestReturn) {
          bestReturn = ret;
          best = j;
        }
      }
      if (best < 0) break;
      base[best].alloc += increment;
      remaining -= increment;
    }
  }

  const moves: AllocationMove[] = base.map((b) => ({
    channelId: b.channel.id,
    channelName: b.channel.name,
    current: b.current,
    recommended: b.alloc,
    delta: b.alloc - b.current,
    marginalReturnBefore: b.ltv / marginalCac(b.channel.saturation, b.current),
    marginalReturnAfter: b.ltv / marginalCac(b.channel.saturation, b.alloc),
  }));

  const summarize = (pick: (b: (typeof base)[number]) => number) => {
    const scaled = base.map((b) => ({
      ...b.channel,
      spend: scaleStack(b.channel.spend, pick(b)),
    }));
    const econ = computePortfolio(scaled, assumptions);
    return {
      returnPerDollar: econ.returnPerDollar,
      customers: econ.customers,
      newArr: econ.newArr,
    };
  };

  return {
    moves,
    baseline: summarize((b) => b.current),
    projected: summarize((b) => b.alloc),
  };
}
