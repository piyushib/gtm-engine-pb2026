// Live simulation: advances the world one day at a time.
//
// Design choice worth knowing: baseline drift is deliberately small and
// mean-reverting, and genuine deterioration arrives as discrete *shocks* —
// a competitor entering an auction, a cohort's lead quality dropping. Real GTM
// economics do not decay on a smooth ramp; they decay in lumps, and the lump is
// exactly what an early-warning system has to catch while it is still small.
//
// Events are rendered from the same drift that moves the model, so the activity
// tape and the economics can never disagree — there is one source of truth.

import { SEED_CHANNELS } from "./seed";
import { Channel, ChannelGroup, MOTION_IDS, MOTION_LABELS, MotionId } from "./types";
import { compactMoney, money } from "./format";

export type EventKind = "won" | "lost" | "expanded" | "cost" | "shock" | "recovered";

export interface LiveEvent {
  id: number;
  day: number;
  kind: EventKind;
  channelId: string;
  text: string;
  /** MRR impact where the event has one. */
  mrr?: number;
}

export interface Shock {
  id: number;
  channelId: string;
  channelName: string;
  label: string;
  remaining: number;
  totalDays: number;
  /** Per-day multiplier added to the channel's half-saturation spend. */
  hStep: number;
  /** Per-day multiplier added to the channel's churn. */
  churnStep: number;
}

const SEED_BY_ID = new Map(SEED_CHANNELS.map((c) => [c.id, c]));

/**
 * Structural per-day pressure by channel group. Paid inventory inflates,
 * organic surfaces compound. These are background, not the story.
 */
const GROUP_PRESSURE: Record<ChannelGroup, number> = {
  Paid: 0.0014,
  Outbound: 0.0007,
  "Organic & AEO": -0.0009,
  Partner: 0.0002,
  Lifecycle: -0.0003,
};

const SHOCK_TEMPLATES = [
  {
    hStep: 0.013,
    churnStep: 0,
    minDays: 16,
    maxDays: 30,
    label: (name: string) => `Competitor entered the ${name} auction — inventory cost climbing`,
  },
  {
    hStep: 0.002,
    churnStep: 0.016,
    minDays: 14,
    maxDays: 26,
    label: (name: string) => `${name} cohort quality degrading — early churn rising`,
  },
  {
    hStep: 0.009,
    churnStep: 0.009,
    minDays: 12,
    maxDays: 24,
    label: (name: string) => `${name} lead quality dropped — cost up and retention down`,
  },
];

/** Deterministic PRNG so a given day always replays identically. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick<T>(items: T[], weights: number[], r: number): T {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return items[0];
  let acc = r * total;
  for (let i = 0; i < items.length; i++) {
    acc -= Math.max(0, weights[i]);
    if (acc <= 0) return items[i];
  }
  return items[items.length - 1];
}

function pickMotion(channel: Channel, r: number): MotionId {
  return weightedPick(
    MOTION_IDS,
    MOTION_IDS.map((m) => channel.motionMix[m]),
    r
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export interface AdvanceInput {
  day: number;
  channels: Channel[];
  shocks: Shock[];
  nextId: number;
  arpaByMotion: Record<MotionId, number>;
}

export interface AdvanceResult {
  channels: Channel[];
  shocks: Shock[];
  events: LiveEvent[];
  nextId: number;
}

/**
 * Advance one day: age shocks, apply drift to the channel parameters, and emit
 * the events that narrate what just happened.
 */
export function advance(input: AdvanceInput, forceShockOn?: string): AdvanceResult {
  const { day, arpaByMotion } = input;
  const rand = mulberry32(day * 0x9e3779b1);
  const events: LiveEvent[] = [];
  let nextId = input.nextId;

  const emit = (kind: EventKind, channelId: string, text: string, mrr?: number) => {
    events.push({ id: nextId++, day, kind, channelId, text, mrr });
  };

  // --- Shocks: age out, then maybe spawn ------------------------------------
  let shocks = input.shocks
    .map((s) => ({ ...s, remaining: s.remaining - 1 }))
    .filter((s) => {
      if (s.remaining > 0) return true;
      emit("recovered", s.channelId, `${s.channelName} pressure subsided — drift back to baseline`);
      return false;
    });

  const spawn = forceShockOn ?? (shocks.length < 3 && rand() < 1 / 18 ? "random" : null);
  if (spawn) {
    const candidates = input.channels.filter((c) => !shocks.some((s) => s.channelId === c.id));
    if (candidates.length > 0) {
      const target =
        spawn === "random"
          ? weightedPick(
              candidates,
              candidates.map((c) => c.spend.media + c.spend.people + c.spend.content + c.spend.tooling),
              rand()
            )
          : (candidates.find((c) => c.id === spawn) ?? candidates[0]);
      const t = SHOCK_TEMPLATES[Math.floor(rand() * SHOCK_TEMPLATES.length)];
      const days = Math.round(t.minDays + rand() * (t.maxDays - t.minDays));
      const shock: Shock = {
        id: nextId++,
        channelId: target.id,
        channelName: target.name,
        label: t.label(target.name),
        remaining: days,
        totalDays: days,
        hStep: t.hStep,
        churnStep: t.churnStep,
      };
      shocks = [...shocks, shock];
      emit("shock", target.id, `${shock.label} · ~${days}d`);
    }
  }

  const shockByChannel = new Map(shocks.map((s) => [s.channelId, s]));

  // --- Drift ----------------------------------------------------------------
  const channels = input.channels.map((channel) => {
    const seed = SEED_BY_ID.get(channel.id);
    const shock = shockByChannel.get(channel.id);
    const noise = (rand() - 0.5) * 0.004;
    const hStep = 1 + GROUP_PRESSURE[channel.group] + noise + (shock?.hStep ?? 0);
    const churnStep = 1 + (rand() - 0.5) * 0.012 + (shock?.churnStep ?? 0);

    // Clamped against the seed so a long run cannot wander into absurdity.
    const hLo = seed ? seed.saturation.h * 0.4 : channel.saturation.h * 0.4;
    const hHi = seed ? seed.saturation.h * 3.5 : channel.saturation.h * 3.5;

    const retention = { ...channel.retention };
    for (const m of MOTION_IDS) {
      const base = seed?.retention[m] ?? channel.retention[m];
      const cur = channel.retention[m];
      retention[m] = {
        ...cur,
        monthlyLogoChurn: clamp(
          cur.monthlyLogoChurn * churnStep,
          base.monthlyLogoChurn * 0.5,
          base.monthlyLogoChurn * 3
        ),
        minMonthlyChurn: clamp(
          cur.minMonthlyChurn * churnStep,
          base.minMonthlyChurn * 0.5,
          base.minMonthlyChurn * 3
        ),
      };
    }

    return {
      ...channel,
      saturation: {
        ...channel.saturation,
        h: clamp(channel.saturation.h * hStep, hLo, hHi),
      },
      retention,
    };
  });

  // --- Narration ------------------------------------------------------------
  // Cost events only where the move is big enough to be worth reading.
  for (const channel of channels) {
    const before = input.channels.find((c) => c.id === channel.id)!;
    const move = channel.saturation.h / before.saturation.h - 1;
    if (move > 0.004) {
      emit(
        "cost",
        channel.id,
        `${channel.name} acquisition cost +${(move * 100).toFixed(1)}% — same spend, fewer customers`
      );
    }
  }

  const spendWeights = channels.map(
    (c) => c.spend.media + c.spend.people + c.spend.content + c.spend.tooling
  );

  const count = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    const channel = weightedPick(channels, spendWeights, rand());
    const motion = pickMotion(channel, rand());
    const arpa = arpaByMotion[motion] * channel.arpaMultiplier;
    const roll = rand();

    if (roll < 0.46) {
      const n = 1 + Math.floor(rand() * 2);
      emit(
        "won",
        channel.id,
        `Won ${n} ${MOTION_LABELS[motion]} ${n === 1 ? "logo" : "logos"} · ${channel.name}`,
        arpa * n
      );
    } else if (roll < 0.78) {
      emit(
        "lost",
        channel.id,
        `Lost 1 ${MOTION_LABELS[motion]} logo · ${channel.name}`,
        -arpa
      );
    } else {
      const n = 1 + Math.floor(rand() * 3);
      emit(
        "expanded",
        channel.id,
        `Expansion on ${n} ${MOTION_LABELS[motion]} ${n === 1 ? "account" : "accounts"} · ${channel.name}`,
        arpa * n * 0.18
      );
    }
  }

  return { channels, shocks, events, nextId };
}

/** Human-readable MRR delta for an event row. */
export function eventAmount(e: LiveEvent): string | null {
  if (e.mrr === undefined) return null;
  const sign = e.mrr >= 0 ? "+" : "−";
  const abs = Math.abs(e.mrr);
  return `${sign}${abs >= 1000 ? compactMoney(abs) : money(abs)}`;
}
