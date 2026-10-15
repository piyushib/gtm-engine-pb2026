"use client";

import clsx from "clsx";
import { PortfolioEconomics } from "@/lib/types";
import {
  compactMoney,
  goodnessColor,
  inverseGoodnessColor,
  money,
  months,
  multiple,
  number,
  percent,
} from "@/lib/format";
import {
  SEVERITY_HEX,
  SEVERITY_TEXT,
  SensorReading,
  projectionText,
  trendPerWeek,
} from "@/lib/sensors";
import { useSensors } from "@/lib/store";
import Sparkline from "./Sparkline";
import SeverityDot from "./SeverityDot";

function Kpi({
  label,
  value,
  sub,
  tone,
  hint,
  reading,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  hint?: string;
  /** When present the card becomes a heat sensor: tone, dot and trend follow it. */
  reading?: SensorReading;
}) {
  const severity = reading?.severity ?? "ok";
  const hot = reading !== undefined && severity !== "ok";
  const trend = reading ? trendPerWeek(reading) : null;

  return (
    <div
      className={clsx(
        "relative min-w-[104px] flex-1 border-r border-ink-800 px-3 py-2 last:border-r-0",
        hot && "bg-ink-850/40"
      )}
      title={
        reading
          ? `${reading.def.why}${projectionText(reading) ? `\n\n${projectionText(reading)}` : ""}`
          : hint
      }
    >
      {hot && (
        <span
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{ background: SEVERITY_HEX[severity] }}
        />
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-2xs uppercase tracking-wider text-slate-500">{label}</span>
        {hot && <SeverityDot severity={severity} size={5} />}
      </div>
      <div
        className={clsx(
          "text-sm font-semibold tabular-nums",
          reading ? SEVERITY_TEXT[severity] : (tone ?? "text-slate-100")
        )}
      >
        {value}
      </div>
      <div className="flex items-center gap-1.5">
        {sub && <div className="text-2xs text-slate-500 tabular-nums">{sub}</div>}
        {reading && (
          <span className="ml-auto flex items-center gap-1">
            {trend !== null && (
              <span
                className={clsx(
                  "text-2xs tabular-nums",
                  reading.deteriorating ? "text-accent-rose" : "text-accent-lime"
                )}
              >
                {trend > 0 ? "▲" : "▼"}
                {percent(Math.abs(trend), 1)}
              </span>
            )}
            <Sparkline
              series={reading.history}
              color={hot ? SEVERITY_HEX[severity] : "#3d4a5e"}
              width={36}
              height={12}
            />
          </span>
        )}
      </div>
    </div>
  );
}

export default function KpiStrip({ portfolio: p }: { portfolio: PortfolioEconomics }) {
  const sensors = useSensors(p);
  const by = (id: string) => sensors.find((s) => s.def.id === id);

  return (
    <div className="flex flex-wrap border-t border-ink-800 bg-ink-900/40">
      <Kpi
        label="GTM spend / mo"
        value={compactMoney(p.totalSpend)}
        sub={`${compactMoney(p.totalSpend * 12)} / yr`}
        hint="Fully-loaded: media, people, content and tooling"
      />
      <Kpi
        label="New customers"
        value={number(p.customers, 1)}
        sub={`${compactMoney(p.newMrr)} new MRR`}
        hint="Monthly acquisition at the current spend level, after diminishing returns"
      />
      <Kpi
        label="Marginal $ return"
        value={`$${(by("marginalReturn")?.value ?? 0).toFixed(2)}`}
        sub="next dollar"
        reading={by("marginalReturn")}
      />
      <Kpi
        label="Blended CAC"
        value={money(p.cac)}
        sub={`${money(p.cacPaidOnly)} paid-only`}
        tone={inverseGoodnessColor(p.cac, 4000, 16000)}
        reading={by("cac")}
      />
      <Kpi
        label="CAC payback"
        value={months(p.paybackMonths)}
        sub="on gross profit"
        tone={inverseGoodnessColor(p.paybackMonths, 10, 24)}
        reading={by("payback")}
      />
      <Kpi
        label="LTV : CAC"
        value={multiple(p.ltvToCac)}
        sub={`${compactMoney(p.ltv)} LTV`}
        tone={goodnessColor(p.ltvToCac, 1.5, 4)}
        reading={by("ltvToCac")}
      />
      <Kpi
        label="NRR (12 mo)"
        value={percent(p.nrr12)}
        sub={`${percent(p.grr12)} GRR`}
        tone={goodnessColor(p.nrr12, 0.8, 1.1)}
        reading={by("nrr")}
      />
      <Kpi
        label="Logo retention"
        value={percent(p.logoRetention12)}
        sub="12 mo"
        tone={goodnessColor(p.logoRetention12, 0.5, 0.85)}
        hint="Share of acquired logos still active after 12 months"
      />
      <Kpi
        label="Magic number"
        value={multiple(p.magicNumber, 2)}
        sub="new ARR / $1"
        tone={goodnessColor(p.magicNumber, 0.5, 1.2)}
        reading={by("magicNumber")}
      />
      <Kpi
        label="GP per $1"
        value={`$${p.returnPerDollar.toFixed(2)}`}
        sub={`$${(p.grossProfit36 / p.totalSpend).toFixed(2)} @ 36 mo`}
        tone={goodnessColor(p.returnPerDollar, 0.6, 1.5)}
        reading={by("returnPerDollar")}
      />
    </div>
  );
}
