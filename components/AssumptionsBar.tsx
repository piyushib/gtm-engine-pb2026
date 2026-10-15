"use client";

import { useGtm } from "@/lib/store";
import { MOTION_IDS, MOTION_LABELS, MotionId } from "@/lib/types";
import { percent } from "@/lib/format";

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-2xs text-slate-500">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 w-24 cursor-pointer appearance-none rounded bg-ink-700 accent-accent-cyan"
      />
      <span className="w-14 text-2xs font-medium tabular-nums text-slate-300">{display}</span>
    </label>
  );
}

export default function AssumptionsBar() {
  const assumptions = useGtm((s) => s.assumptions);
  const setAssumption = useGtm((s) => s.setAssumption);
  const setMotionArpa = useGtm((s) => s.setMotionArpa);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-ink-800 bg-ink-900/20 px-5 py-2">
      <span className="text-2xs font-medium uppercase tracking-wider text-slate-600">
        Assumptions
      </span>

      <Slider
        label="Gross margin"
        value={assumptions.grossMargin}
        min={0.4}
        max={0.95}
        step={0.01}
        display={percent(assumptions.grossMargin)}
        onChange={(v) => setAssumption("grossMargin", v)}
      />
      <Slider
        label="Discount rate"
        value={assumptions.discountRateAnnual}
        min={0}
        max={0.4}
        step={0.01}
        display={percent(assumptions.discountRateAnnual)}
        onChange={(v) => setAssumption("discountRateAnnual", v)}
      />
      <Slider
        label="LTV horizon"
        value={assumptions.ltvHorizonMonths}
        min={12}
        max={60}
        step={6}
        display={`${assumptions.ltvHorizonMonths} mo`}
        onChange={(v) => setAssumption("ltvHorizonMonths", v)}
      />
      <span
        title="How a channel's spend is split across motions. 0 = spend follows customer count (equal CAC per motion); 1 = spend follows revenue (equal CAC:ARPA per motion). Self-serve economics are most sensitive to this."
        className="cursor-help border-b border-dotted border-ink-600"
      >
        <Slider
          label="Effort ∝ ARPA^"
          value={assumptions.salesEffortExponent}
          min={0}
          max={1}
          step={0.01}
          display={assumptions.salesEffortExponent.toFixed(2)}
          onChange={(v) => setAssumption("salesEffortExponent", v)}
        />
      </span>

      <span className="text-2xs text-slate-600">|</span>
      <span className="text-2xs uppercase tracking-wider text-slate-600">ARPA / mo</span>
      {MOTION_IDS.map((motion: MotionId) => (
        <label key={motion} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-2xs text-slate-500">{MOTION_LABELS[motion]}</span>
          <input
            type="number"
            value={Math.round(assumptions.motions[motion].arpa)}
            onChange={(e) => setMotionArpa(motion, parseFloat(e.target.value) || 0)}
            className="w-16 rounded border border-ink-700 bg-ink-900 px-1.5 py-0.5 text-right text-2xs tabular-nums text-slate-200 outline-none focus:border-accent-cyan/60"
          />
        </label>
      ))}

      <span className="ml-auto text-2xs text-slate-600">
        Cost to serve nets off gross margin per motion · self-serve{" "}
        {percent(assumptions.grossMargin - assumptions.motions.selfServe.costToServe)} → enterprise{" "}
        {percent(assumptions.grossMargin - assumptions.motions.enterprise.costToServe)}
      </span>
    </div>
  );
}
