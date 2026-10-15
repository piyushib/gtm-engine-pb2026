"use client";

import { useEffect } from "react";
import { Pause, Play, Zap } from "lucide-react";
import clsx from "clsx";
import { useGtm } from "@/lib/store";

const SPEEDS: [number, string][] = [
  [1000, "1d/s"],
  [400, "2d/s"],
  [150, "6d/s"],
];

export default function LiveControls() {
  const running = useGtm((s) => s.running);
  const speedMs = useGtm((s) => s.speedMs);
  const day = useGtm((s) => s.day);
  const toggleLive = useGtm((s) => s.toggleLive);
  const setSpeed = useGtm((s) => s.setSpeed);
  const tick = useGtm((s) => s.tick);
  const injectShock = useGtm((s) => s.injectShock);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, speedMs);
    return () => clearInterval(id);
  }, [running, speedMs, tick]);

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-900 p-0.5">
      <button
        onClick={toggleLive}
        className={clsx(
          "flex items-center gap-1.5 rounded px-2 py-1 text-2xs font-medium transition",
          running
            ? "bg-accent-lime/15 text-accent-lime"
            : "text-slate-400 hover:bg-ink-850 hover:text-slate-200"
        )}
        title={running ? "Pause the simulated clock" : "Advance one simulated day per tick"}
      >
        {running ? <Pause size={12} /> : <Play size={12} />}
        {running ? "Live" : "Start"}
        {running && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-lime" />
        )}
      </button>

      <span className="font-mono text-2xs tabular-nums text-slate-500" title="Simulated days elapsed">
        d{day}
      </span>

      <span className="flex">
        {SPEEDS.map(([ms, label]) => (
          <button
            key={ms}
            onClick={() => setSpeed(ms)}
            className={clsx(
              "rounded px-1.5 py-1 text-2xs transition",
              speedMs === ms ? "text-slate-200" : "text-slate-600 hover:text-slate-400"
            )}
          >
            {label}
          </button>
        ))}
      </span>

      <button
        onClick={() => injectShock()}
        className="flex items-center gap-1 rounded px-1.5 py-1 text-2xs text-slate-500 transition hover:bg-accent-rose/10 hover:text-accent-rose"
        title="Force an adverse regime onto the largest unshocked channel — competitor auction entry, cohort quality drop, or both. Use it to watch the sensors pick up a problem before it breaches."
      >
        <Zap size={11} /> Shock
      </button>
    </div>
  );
}
