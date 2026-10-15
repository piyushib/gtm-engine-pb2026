"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { SEED_ASSUMPTIONS, SEED_CHANNELS } from "./seed";
import { computePortfolio, optimizeAllocation, scaleStack, stackTotal } from "./model";
import { Assumptions, Channel, CostStack, MOTION_IDS, MotionId, PortfolioEconomics } from "./types";
import { LiveEvent, Shock, advance } from "./live";
import {
  ChannelAlert,
  SEVERITY_RANK,
  SensorReading,
  Severity,
  appendHistory,
  projectionText,
  readChannelAlerts,
  readSensors,
  sensorValues,
} from "./sensors";

export type ViewMode = "sheet" | "dashboard";

export interface Toast {
  key: string;
  severity: Severity;
  title: string;
  body: string;
  day: number;
}

/** Newest-first event tape length. Older events age off. */
const EVENT_CAP = 80;

interface GtmState {
  channels: Channel[];
  assumptions: Assumptions;
  view: ViewMode;
  selectedChannelId: string | null;
  /** Channels excluded from the portfolio without losing their assumptions. */
  disabled: Record<string, boolean>;

  setView: (view: ViewMode) => void;
  selectChannel: (id: string | null) => void;
  toggleChannel: (id: string) => void;
  /** Edit one line of a channel's cost stack. */
  setCostLine: (id: string, key: keyof CostStack, value: number) => void;
  /** Edit a channel's total spend, preserving cost composition. */
  setChannelSpend: (id: string, total: number) => void;
  setAssumption: <K extends keyof Assumptions>(key: K, value: Assumptions[K]) => void;
  setMotionArpa: (motion: keyof Assumptions["motions"], arpa: number) => void;
  applyOptimizedAllocation: () => void;
  reset: () => void;

  // --- Live tracking -------------------------------------------------------
  running: boolean;
  /** Milliseconds of wall clock per simulated day. */
  speedMs: number;
  day: number;
  events: LiveEvent[];
  shocks: Shock[];
  /** Per-sensor rolling history, the basis for every trend fit. */
  history: Record<string, number[]>;
  /** Last recorded severity per sensor/channel key, for escalation detection. */
  severities: Record<string, Severity>;
  toasts: Toast[];
  nextId: number;

  toggleLive: () => void;
  setSpeed: (ms: number) => void;
  tick: () => void;
  /** Force an adverse regime onto a channel — used to exercise the alert path. */
  injectShock: (channelId?: string) => void;
  dismissToast: (key: string) => void;
}

const INITIAL_LIVE = {
  running: false,
  speedMs: 600,
  day: 0,
  events: [] as LiveEvent[],
  shocks: [] as Shock[],
  history: {} as Record<string, number[]>,
  severities: {} as Record<string, Severity>,
  toasts: [] as Toast[],
  nextId: 1,
};

function arpaByMotion(assumptions: Assumptions): Record<MotionId, number> {
  const out = {} as Record<MotionId, number>;
  for (const m of MOTION_IDS) out[m] = assumptions.motions[m].arpa;
  return out;
}

export const useGtm = create<GtmState>((set) => ({
  channels: SEED_CHANNELS,
  assumptions: SEED_ASSUMPTIONS,
  view: "sheet",
  selectedChannelId: null,
  disabled: {},
  ...INITIAL_LIVE,

  setView: (view) => set({ view }),
  selectChannel: (selectedChannelId) => set({ selectedChannelId }),

  toggleChannel: (id) =>
    set((state) => ({ disabled: { ...state.disabled, [id]: !state.disabled[id] } })),

  setCostLine: (id, key, value) =>
    set((state) => ({
      channels: state.channels.map((c) =>
        c.id === id ? { ...c, spend: { ...c.spend, [key]: Math.max(0, value) } } : c
      ),
    })),

  setChannelSpend: (id, total) =>
    set((state) => ({
      channels: state.channels.map((c) =>
        c.id === id ? { ...c, spend: scaleStack(c.spend, Math.max(0, total)) } : c
      ),
    })),

  setAssumption: (key, value) =>
    set((state) => ({ assumptions: { ...state.assumptions, [key]: value } })),

  setMotionArpa: (motion, arpa) =>
    set((state) => ({
      assumptions: {
        ...state.assumptions,
        motions: {
          ...state.assumptions.motions,
          [motion]: { ...state.assumptions.motions[motion], arpa: Math.max(0, arpa) },
        },
      },
    })),

  applyOptimizedAllocation: () =>
    set((state) => {
      const active = state.channels.filter((c) => !state.disabled[c.id]);
      const budget = active.reduce((s, c) => s + stackTotal(c.spend), 0);
      const { moves } = optimizeAllocation(active, state.assumptions, budget);
      const byId = new Map(moves.map((m) => [m.channelId, m.recommended]));
      return {
        channels: state.channels.map((c) =>
          byId.has(c.id) ? { ...c, spend: scaleStack(c.spend, byId.get(c.id)!) } : c
        ),
      };
    }),

  reset: () =>
    set({
      channels: SEED_CHANNELS,
      assumptions: SEED_ASSUMPTIONS,
      disabled: {},
      selectedChannelId: null,
      ...INITIAL_LIVE,
    }),

  toggleLive: () => set((state) => ({ running: !state.running })),
  setSpeed: (speedMs) => set({ speedMs }),
  dismissToast: (key) => set((state) => ({ toasts: state.toasts.filter((t) => t.key !== key) })),

  injectShock: (channelId) =>
    set((state) => applyDay(state, channelId ?? largestChannelId(state))),

  tick: () => set((state) => applyDay(state)),
}));

function largestChannelId(state: GtmState): string {
  const active = state.channels.filter((c) => !state.disabled[c.id]);
  const shocked = new Set(state.shocks.map((s) => s.channelId));
  const candidates = active.filter((c) => !shocked.has(c.id));
  const pool = candidates.length > 0 ? candidates : active;
  return pool.reduce((a, b) => (stackTotal(b.spend) > stackTotal(a.spend) ? b : a)).id;
}

/**
 * Advance the world one day, then re-read every sensor against the new state.
 *
 * History is recorded here rather than in a component effect so the trend fit
 * can never miss a day or double-count one — the economics and the sensor
 * history always move in the same transaction.
 */
function applyDay(state: GtmState, forceShockOn?: string): Partial<GtmState> {
  const day = state.day + 1;

  const { channels, shocks, events, nextId } = advance(
    {
      day,
      channels: state.channels,
      shocks: state.shocks,
      nextId: state.nextId,
      arpaByMotion: arpaByMotion(state.assumptions),
    },
    forceShockOn
  );

  const active = channels.filter((c) => !state.disabled[c.id]);
  const portfolio = computePortfolio(active, state.assumptions);
  const history = appendHistory(state.history, sensorValues(portfolio));
  const readings = readSensors(portfolio, history);
  const channelAlerts = readChannelAlerts(portfolio.channels);

  const severities: Record<string, Severity> = {};
  const fresh: Toast[] = [];

  const record = (key: string, severity: Severity, title: string, body: string) => {
    severities[key] = severity;
    const prev = state.severities[key] ?? "ok";
    // Only escalations notify. Recoveries update the heat silently, otherwise a
    // metric oscillating around a threshold would fire forever.
    if (severity !== "ok" && SEVERITY_RANK[severity] > SEVERITY_RANK[prev]) {
      fresh.push({ key: `${key}@${day}`, severity, title, body, day });
    }
  };

  for (const r of readings) {
    record(
      r.def.id,
      r.severity,
      `${r.def.label} · ${r.display}`,
      projectionText(r) ?? r.def.why
    );
  }
  for (const a of channelAlerts) {
    record(`ch:${a.channelId}`, a.severity, `${a.channelName} · ${a.headline}`, a.detail);
  }

  return {
    day,
    channels,
    shocks,
    nextId,
    history,
    severities,
    events: [...events.reverse(), ...state.events].slice(0, EVENT_CAP),
    toasts: [...fresh, ...state.toasts].slice(0, 4),
  };
}

/** Channels currently included in the portfolio. */
export function useActiveChannels(): Channel[] {
  const channels = useGtm((s) => s.channels);
  const disabled = useGtm((s) => s.disabled);
  return useMemo(() => channels.filter((c) => !disabled[c.id]), [channels, disabled]);
}

export function usePortfolio(): PortfolioEconomics {
  const channels = useActiveChannels();
  const assumptions = useGtm((s) => s.assumptions);
  return useMemo(() => computePortfolio(channels, assumptions), [channels, assumptions]);
}

/**
 * Sensor readings derived from the live portfolio. Deriving here rather than
 * reading a stored snapshot means manual spend edits update the heat
 * immediately, not just on the next tick.
 *
 * Takes the portfolio as an argument because `usePortfolio` memoizes per call
 * site — calling it from every consumer would recompute the whole portfolio
 * several times per tick.
 */
export function useSensors(portfolio: PortfolioEconomics): SensorReading[] {
  const history = useGtm((s) => s.history);
  return useMemo(() => readSensors(portfolio, history), [portfolio, history]);
}

export function useChannelAlerts(portfolio: PortfolioEconomics): ChannelAlert[] {
  return useMemo(() => readChannelAlerts(portfolio.channels), [portfolio]);
}
