// Early-warning layer over the economics engine.
//
// The premise: a threshold alarm that fires when CAC payback *reaches* 24
// months is worthless, because the money is already spent. What matters is the
// first derivative — how fast a metric is moving toward its threshold, and how
// many days of runway are left before it crosses. So every sensor carries a
// level AND a least-squares trend over a rolling window, and escalates to
// "watch" while the level is still healthy.

import { ChannelEconomics, PortfolioEconomics } from "./types";
import { money, months, multiple, percent } from "./format";

export type Severity = "ok" | "watch" | "amber" | "red";

export const SEVERITY_RANK: Record<Severity, number> = { ok: 0, watch: 1, amber: 2, red: 3 };

export const SEVERITY_LABEL: Record<Severity, string> = {
  ok: "Healthy",
  watch: "Watch",
  amber: "Amber",
  red: "Critical",
};

export const SEVERITY_HEX: Record<Severity, string> = {
  ok: "#a3e635",
  watch: "#fbbf24",
  amber: "#fb923c",
  red: "#fb7185",
};

export const SEVERITY_TEXT: Record<Severity, string> = {
  ok: "text-accent-lime",
  watch: "text-accent-amber",
  amber: "text-accent-orange",
  red: "text-accent-rose",
};

/** Days of history used to fit the trend. */
export const TREND_WINDOW = 14;
/** How far ahead a projected breach still counts as actionable. */
export const WATCH_HORIZON_DAYS = 30;
/** Rolling history retained per sensor. */
export const HISTORY_CAP = 180;

export interface SensorDef {
  id: string;
  label: string;
  read: (p: PortfolioEconomics) => number;
  format: (v: number) => string;
  /** Which direction is deterioration. */
  worse: "up" | "down";
  amber: number;
  red: number;
  /** What a breach would mean, and what to look at. */
  why: string;
}

/**
 * Spend-weighted marginal return: what the *next* dollar returns across the
 * portfolio. This is the true leading indicator — it degrades while average
 * CAC still looks fine, because averages are dominated by dollars already spent.
 */
export function portfolioMarginalReturn(p: PortfolioEconomics): number {
  const total = p.channels.reduce((s, c) => s + c.totalSpend, 0);
  if (total <= 0) return 0;
  return p.channels.reduce((s, c) => s + c.marginalReturnPerDollar * c.totalSpend, 0) / total;
}

export const SENSORS: SensorDef[] = [
  {
    id: "marginalReturn",
    label: "Marginal $ return",
    read: portfolioMarginalReturn,
    format: (v) => `$${v.toFixed(2)}`,
    worse: "down",
    amber: 1.15,
    red: 1.0,
    why: "Gross profit returned by the next dollar of spend. Below $1.00 the next dollar destroys value even while average return still looks healthy — this moves first, which is why it is the sensor to trust.",
  },
  {
    id: "cac",
    label: "Blended CAC",
    read: (p) => p.cac,
    format: (v) => money(v),
    worse: "up",
    amber: 11_000,
    red: 13_500,
    why: "Fully-loaded cost to acquire one customer. Rising CAC with flat spend means the channels are saturating — check which channel's marginal CAC is climbing fastest.",
  },
  {
    id: "payback",
    label: "CAC payback",
    read: (p) => p.paybackMonths ?? 120,
    format: (v) => months(v >= 120 ? null : v),
    worse: "up",
    amber: 18,
    red: 24,
    why: "Months of gross profit needed to repay CAC. Past 24 months the business is financing growth out of capital rather than out of customers.",
  },
  {
    id: "ltvToCac",
    label: "LTV : CAC",
    read: (p) => p.ltvToCac,
    format: (v) => multiple(v, 2),
    worse: "down",
    amber: 2.0,
    red: 1.5,
    why: "Lifetime gross profit over fully-loaded CAC. Below 1.5x there is no margin left to absorb a bad quarter of retention.",
  },
  {
    id: "nrr",
    label: "NRR (12 mo)",
    read: (p) => p.nrr12,
    format: (v) => percent(v, 1),
    worse: "down",
    amber: 1.0,
    red: 0.95,
    why: "Net dollar retention at month 12. Falling through 100% means expansion no longer covers churn, so growth has to be bought entirely with new logos.",
  },
  {
    id: "grr",
    label: "GRR (12 mo)",
    read: (p) => p.grr12,
    format: (v) => percent(v, 1),
    worse: "down",
    amber: 0.75,
    red: 0.7,
    why: "Gross dollar retention — the floor before expansion. Expansion can mask a deteriorating base for a long time; GRR cannot be masked.",
  },
  {
    id: "returnPerDollar",
    label: "GP per $1",
    read: (p) => p.returnPerDollar,
    format: (v) => `$${v.toFixed(2)}`,
    worse: "down",
    amber: 0.65,
    red: 0.5,
    why: "Discounted gross profit returned in the first 12 months per dollar spent. The headline efficiency number, and the slowest to react.",
  },
  {
    id: "magicNumber",
    label: "Magic number",
    read: (p) => p.magicNumber,
    format: (v) => v.toFixed(2),
    worse: "down",
    amber: 0.75,
    red: 0.5,
    why: "New ARR booked per dollar of GTM spend. Below 0.75 most boards stop funding incremental spend.",
  },
];

/** Least-squares slope per day over the sample window. */
export function slopePerDay(series: number[]): number {
  const n = series.length;
  if (n < 4) return 0;
  const xMean = (n - 1) / 2;
  const yMean = series.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    num += dx * (series[i] - yMean);
    den += dx * dx;
  }
  return den > 0 ? num / den : 0;
}

function levelSeverity(def: SensorDef, value: number): Severity {
  if (def.worse === "up") {
    return value >= def.red ? "red" : value >= def.amber ? "amber" : "ok";
  }
  return value <= def.red ? "red" : value <= def.amber ? "amber" : "ok";
}

/** Days until `value` reaches `threshold` at the current slope, if ever. */
function daysToThreshold(def: SensorDef, value: number, slope: number, threshold: number) {
  if (slope === 0) return null;
  const deteriorating = def.worse === "up" ? slope > 0 : slope < 0;
  if (!deteriorating) return null;
  const days = (threshold - value) / slope;
  return days > 0 && Number.isFinite(days) ? days : null;
}

export interface SensorReading {
  def: SensorDef;
  value: number;
  display: string;
  /** Change per day, fitted over the trend window. */
  slope: number;
  /** Deterioration as a share of the distance to amber, per day. */
  history: number[];
  levelSeverity: Severity;
  /** Level severity escalated by a projected breach. */
  severity: Severity;
  daysToAmber: number | null;
  daysToRed: number | null;
  deteriorating: boolean;
}

export function readSensor(
  def: SensorDef,
  p: PortfolioEconomics,
  history: number[] = []
): SensorReading {
  const value = def.read(p);
  const window = history.slice(-TREND_WINDOW);
  const slope = slopePerDay(window);
  const level = levelSeverity(def, value);
  const daysToAmber = daysToThreshold(def, value, slope, def.amber);
  const daysToRed = daysToThreshold(def, value, slope, def.red);

  // A healthy level with a breach inside the horizon is the whole point of the
  // sensor: flag it as "watch" before it ever shows up as amber.
  let severity = level;
  if (level === "ok" && daysToAmber !== null && daysToAmber <= WATCH_HORIZON_DAYS) {
    severity = "watch";
  }

  return {
    def,
    value,
    display: def.format(value),
    slope,
    history,
    levelSeverity: level,
    severity,
    daysToAmber,
    daysToRed,
    deteriorating: def.worse === "up" ? slope > 0 : slope < 0,
  };
}

export function readSensors(
  p: PortfolioEconomics,
  history: Record<string, number[]>
): SensorReading[] {
  return SENSORS.map((def) => readSensor(def, p, history[def.id] ?? []));
}

/** Current value of every sensor, for appending to history on each tick. */
export function sensorValues(p: PortfolioEconomics): Record<string, number> {
  const out: Record<string, number> = {};
  for (const def of SENSORS) out[def.id] = def.read(p);
  return out;
}

export function appendHistory(
  history: Record<string, number[]>,
  values: Record<string, number>
): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [id, v] of Object.entries(values)) {
    const prev = history[id] ?? [];
    out[id] = [...prev, v].slice(-HISTORY_CAP);
  }
  return out;
}

/**
 * Relative rate of change per week. Normalising by the current value keeps the
 * number comparable across metrics measured in dollars, months and percent.
 */
export function trendPerWeek(r: SensorReading): number | null {
  if (r.slope === 0 || r.value === 0) return null;
  return (r.slope * 7) / Math.abs(r.value);
}

/**
 * Beyond this, a linear extrapolation is false precision — a near-flat trend
 * will happily project a breach years out, which reads as a number but carries
 * no information.
 */
const PROJECTION_MAX_DAYS = 90;

/** The lead-time sentence: what breaches next, and roughly when. */
export function projectionText(r: SensorReading): string | null {
  if (r.levelSeverity === "red") return "Already past the critical threshold.";

  if (r.levelSeverity === "amber") {
    if (r.daysToRed !== null && r.daysToRed <= PROJECTION_MAX_DAYS) {
      return `Critical in ~${Math.round(r.daysToRed)}d at the current rate.`;
    }
    return r.deteriorating
      ? `Past amber and still slipping — critical at ${r.def.format(r.def.red)}.`
      : "Past amber, but no longer deteriorating.";
  }

  if (r.daysToAmber !== null && r.daysToAmber <= WATCH_HORIZON_DAYS) {
    return `Amber in ~${Math.round(r.daysToAmber)}d at the current rate.`;
  }
  return null;
}

/** Worst severity across the portfolio sensors. */
export function worstSeverity(readings: { severity: Severity }[]): Severity {
  return readings.reduce<Severity>(
    (worst, r) => (SEVERITY_RANK[r.severity] > SEVERITY_RANK[worst] ? r.severity : worst),
    "ok"
  );
}

// ---------------------------------------------------------------------------
// Channel-level heat
// ---------------------------------------------------------------------------

export interface ChannelAlert {
  channelId: string;
  channelName: string;
  severity: Severity;
  headline: string;
  detail: string;
}

/**
 * Channel checks are level-only on purpose. At channel grain the question is
 * binary and already actionable — is the next dollar into this channel worth
 * spending — so a trend adds noise rather than lead time.
 */
export function readChannelAlerts(channels: ChannelEconomics[]): ChannelAlert[] {
  const alerts: ChannelAlert[] = [];

  for (const c of channels) {
    const checks: { severity: Severity; headline: string; detail: string }[] = [];

    if (c.marginalReturnPerDollar < 1.0) {
      checks.push({
        severity: "red",
        headline: `Next dollar returns $${c.marginalReturnPerDollar.toFixed(2)}`,
        detail: `Marginal CAC is ${money(c.marginalCac)} against ${money(
          c.ltv
        )} LTV. Spending more here destroys value; the budget belongs elsewhere.`,
      });
    } else if (c.marginalReturnPerDollar < 1.15) {
      checks.push({
        severity: "amber",
        headline: `Next dollar returns only $${c.marginalReturnPerDollar.toFixed(2)}`,
        detail: `${percent(c.saturationLevel)} saturated — the channel is close to the point where incremental spend stops paying.`,
      });
    }

    if (c.ltvToCac < 1.0) {
      checks.push({
        severity: "red",
        headline: `LTV:CAC ${multiple(c.ltvToCac, 2)} — underwater`,
        detail: `Every customer acquired here loses money over ${money(c.cac)} of fully-loaded CAC.`,
      });
    } else if (c.ltvToCac < 1.5) {
      checks.push({
        severity: "amber",
        headline: `LTV:CAC ${multiple(c.ltvToCac, 2)} — thin`,
        detail: `No margin left to absorb a retention miss. Payback is ${months(c.paybackMonths)}.`,
      });
    }

    if (checks.length === 0) continue;

    // One alert per channel — the worst condition. Nine channels × three checks
    // would be noise, and noise is how early-warning systems get ignored.
    const worst = checks.reduce((a, b) =>
      SEVERITY_RANK[b.severity] > SEVERITY_RANK[a.severity] ? b : a
    );
    alerts.push({
      channelId: c.channel.id,
      channelName: c.channel.name,
      severity: worst.severity,
      headline: worst.headline,
      detail: worst.detail,
    });
  }

  return alerts.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}
