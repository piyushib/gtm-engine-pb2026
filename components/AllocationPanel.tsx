"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { ArrowRight, Wand2 } from "lucide-react";
import { useActiveChannels, useGtm } from "@/lib/store";
import { optimizeAllocation, stackTotal } from "@/lib/model";
import { CHANNEL_COLORS, compactMoney, multiple } from "@/lib/format";

export default function AllocationPanel() {
  const channels = useActiveChannels();
  const assumptions = useGtm((s) => s.assumptions);
  const apply = useGtm((s) => s.applyOptimizedAllocation);

  const result = useMemo(() => {
    const budget = channels.reduce((s, c) => s + stackTotal(c.spend), 0);
    return optimizeAllocation(channels, assumptions, budget);
  }, [channels, assumptions]);

  const moves = [...result.moves].sort((a, b) => b.delta - a.delta);
  const maxDelta = Math.max(...moves.map((m) => Math.abs(m.delta)), 1);
  const arrLift = result.projected.newArr - result.baseline.newArr;
  const custLift = result.projected.customers - result.baseline.customers;

  return (
    <div className="card">
      <div className="mb-2 flex items-start gap-2">
        <div className="mr-auto">
          <h3 className="text-xs font-semibold text-slate-200">Reallocation</h3>
          <p className="text-2xs text-slate-500">
            Same budget, redistributed until the next dollar earns the same everywhere
          </p>
        </div>
        <button
          onClick={apply}
          className="flex items-center gap-1.5 rounded-md border border-accent-cyan/40 bg-accent-cyan/10 px-2 py-1 text-2xs font-medium text-accent-cyan transition hover:bg-accent-cyan/20"
        >
          <Wand2 size={12} /> Apply
        </button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        {[
          {
            label: "New ARR",
            value: `${arrLift >= 0 ? "+" : "−"}${compactMoney(Math.abs(arrLift))}`,
            good: arrLift >= 0,
          },
          {
            label: "Customers / mo",
            value: `${custLift >= 0 ? "+" : "−"}${Math.abs(custLift).toFixed(1)}`,
            good: custLift >= 0,
          },
          {
            label: "GP per $1",
            value: `$${result.baseline.returnPerDollar.toFixed(2)} → $${result.projected.returnPerDollar.toFixed(2)}`,
            good: result.projected.returnPerDollar >= result.baseline.returnPerDollar,
          },
        ].map(({ label, value, good }) => (
          <div key={label} className="rounded border border-ink-800 bg-ink-850/60 p-2">
            <div className="text-2xs uppercase tracking-wide text-slate-500">{label}</div>
            <div
              className={clsx(
                "text-xs font-semibold tabular-nums",
                good ? "text-accent-lime" : "text-accent-rose"
              )}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {moves.map((m) => {
          const pct = Math.abs(m.delta) / maxDelta;
          const grow = m.delta > 0;
          return (
            <div key={m.channelId} className="flex items-center gap-2 text-2xs">
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ background: CHANNEL_COLORS[m.channelId] ?? "#64748b" }}
              />
              <span className="w-40 shrink-0 truncate text-slate-300">{m.channelName}</span>

              <div className="flex h-4 flex-1 items-center">
                <div className="flex w-1/2 justify-end">
                  {!grow && (
                    <div
                      className="h-2 rounded-l bg-accent-rose/70"
                      style={{ width: `${pct * 100}%` }}
                    />
                  )}
                </div>
                <div className="w-px self-stretch bg-ink-700" />
                <div className="flex w-1/2">
                  {grow && (
                    <div
                      className="h-2 rounded-r bg-accent-lime/70"
                      style={{ width: `${pct * 100}%` }}
                    />
                  )}
                </div>
              </div>

              <span className="w-32 shrink-0 text-right tabular-nums text-slate-500">
                {compactMoney(m.current)}
                <ArrowRight size={9} className="mx-0.5 inline" />
                <span className={grow ? "text-accent-lime" : "text-accent-rose"}>
                  {compactMoney(m.recommended)}
                </span>
              </span>
              <span
                className="w-20 shrink-0 text-right tabular-nums text-slate-600"
                title="Lifetime gross profit per next dollar, before → after"
              >
                {multiple(m.marginalReturnBefore, 1)} → {multiple(m.marginalReturnAfter, 1)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-2xs text-slate-600">
        Bounded to 40–200% of each channel&apos;s current spend so the answer stays operationally
        plausible. Channels with hard volume ceilings — AEO especially — will refuse budget long
        before their return falls to average.
      </p>
    </div>
  );
}
