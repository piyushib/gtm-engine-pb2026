"use client";

import clsx from "clsx";
import { Sparkles, X } from "lucide-react";
import { useGtm } from "@/lib/store";
import {
  COST_KEYS,
  COST_LABELS,
  MOTION_LABELS,
  PortfolioEconomics,
} from "@/lib/types";
import { projectedCeiling } from "@/lib/model";
import {
  CHANNEL_COLORS,
  MOTION_COLORS,
  compactMoney,
  goodnessColor,
  inverseGoodnessColor,
  money,
  months,
  multiple,
  number,
  percent,
} from "@/lib/format";
import CohortChart from "./charts/CohortChart";
import RetentionWaterfall from "./charts/RetentionWaterfall";

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="rounded border border-ink-800 bg-ink-850/60 px-2 py-1.5" title={hint}>
      <div className="text-2xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={clsx("text-xs font-semibold tabular-nums", tone ?? "text-slate-100")}>
        {value}
      </div>
    </div>
  );
}

export default function ChannelDrawer({ portfolio }: { portfolio: PortfolioEconomics }) {
  const selectedId = useGtm((s) => s.selectedChannelId);
  const selectChannel = useGtm((s) => s.selectChannel);
  const econ = portfolio.channels.find((c) => c.channel.id === selectedId);

  if (!econ) return null;
  const c = econ.channel;
  const color = CHANNEL_COLORS[c.id] ?? "#64748b";

  // Funnel volumes implied by the customers the channel actually produces.
  const won = econ.customers;
  const qualified = won / Math.max(c.funnel.qualifiedToWon, 1e-6);
  const leads = qualified / Math.max(c.funnel.leadToQualified, 1e-6);
  const touches = leads / Math.max(c.funnel.touchToLead, 1e-6);
  const funnel = [
    { label: "Touches / impressions", value: touches, conv: null as number | null },
    { label: "Leads / signups", value: leads, conv: c.funnel.touchToLead },
    { label: "Qualified", value: qualified, conv: c.funnel.leadToQualified },
    { label: "Closed won", value: won, conv: c.funnel.qualifiedToWon },
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
        onClick={() => selectChannel(null)}
      />
      <aside className="relative h-full w-full max-w-3xl overflow-y-auto border-l border-ink-700 bg-ink-900 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-ink-800 bg-ink-900/95 px-4 py-3 backdrop-blur">
          <span className="mt-1 h-3 w-3 shrink-0 rounded" style={{ background: color }} />
          <div className="mr-auto">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              {c.name}
              {c.isAgentic && (
                <span className="chip border-accent-cyan/40 text-accent-cyan">
                  <Sparkles size={9} /> AI-native
                </span>
              )}
            </h2>
            <p className="mt-0.5 max-w-xl text-2xs leading-relaxed text-slate-500">{c.blurb}</p>
          </div>
          <button
            onClick={() => selectChannel(null)}
            className="rounded p-1 text-slate-500 hover:bg-ink-800 hover:text-slate-200"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <Stat label="Spend / mo" value={compactMoney(econ.totalSpend)} />
            <Stat label="Customers" value={number(econ.customers, 1)} />
            <Stat
              label="CAC"
              value={money(econ.cac)}
              tone={inverseGoodnessColor(econ.cac, 3000, 40000)}
            />
            <Stat
              label="Marginal CAC"
              value={money(econ.marginalCac)}
              hint="Cost of the next customer at this spend level"
            />
            <Stat label="ARPA" value={money(econ.arpa)} />
            <Stat label="LTV" value={compactMoney(econ.ltv)} />
            <Stat
              label="LTV : CAC"
              value={multiple(econ.ltvToCac)}
              tone={goodnessColor(econ.ltvToCac, 1, 4)}
            />
            <Stat
              label="Payback"
              value={months(econ.paybackMonths)}
              tone={inverseGoodnessColor(econ.paybackMonths, 8, 30)}
            />
            <Stat
              label="NRR 12 mo"
              value={percent(econ.nrr12)}
              tone={goodnessColor(econ.nrr12, 0.75, 1.1)}
            />
            <Stat label="GRR 12 mo" value={percent(econ.grr12)} />
            <Stat label="Logo ret. 12" value={percent(econ.logoRetention12)} />
            <Stat label="Sales cycle" value={`${c.salesCycleMonths.toFixed(1)} mo`} />
          </div>

          {/* Cost stack */}
          <div className="card">
            <h3 className="mb-2 text-xs font-semibold text-slate-200">Cost stack</h3>
            <div className="mb-2 flex h-4 overflow-hidden rounded">
              {COST_KEYS.map((key) => {
                const colors: Record<string, string> = {
                  media: "#60a5fa",
                  people: "#fb7185",
                  content: "#fbbf24",
                  tooling: "#a78bfa",
                };
                return (
                  <div
                    key={key}
                    style={{
                      width: `${(c.spend[key] / econ.totalSpend) * 100}%`,
                      background: colors[key],
                    }}
                    title={`${COST_LABELS[key]}: ${compactMoney(c.spend[key])}`}
                  />
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              {COST_KEYS.map((key) => (
                <div key={key} className="flex justify-between text-2xs">
                  <span className="text-slate-500">{COST_LABELS[key]}</span>
                  <span className="tabular-nums text-slate-300">
                    {compactMoney(c.spend[key])}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Funnel */}
          <div className="card">
            <h3 className="mb-1 text-xs font-semibold text-slate-200">Funnel</h3>
            <p className="mb-2 text-2xs text-slate-500">
              Volume implied by the {number(econ.customers, 1)} customers this channel produces
            </p>
            <div className="space-y-1.5">
              {funnel.map((stage) => (
                <div key={stage.label} className="flex items-center gap-2 text-2xs">
                  <span className="w-36 shrink-0 text-slate-400">{stage.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(stage.value / touches) * 100}%`,
                        background: color,
                        minWidth: 2,
                      }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right tabular-nums text-slate-300">
                    {number(stage.value, stage.value < 100 ? 1 : 0)}
                  </span>
                  <span className="w-12 shrink-0 text-right tabular-nums text-slate-600">
                    {stage.conv !== null ? percent(stage.conv, 1) : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Motion breakdown */}
          <div className="card">
            <h3 className="mb-2 text-xs font-semibold text-slate-200">By motion</h3>
            <table className="w-full text-2xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="pb-1 text-left font-medium">Motion</th>
                  <th className="pb-1 text-right font-medium">Mix</th>
                  <th className="pb-1 text-right font-medium">Cust.</th>
                  <th className="pb-1 text-right font-medium">CAC</th>
                  <th className="pb-1 text-right font-medium">ARPA</th>
                  <th className="pb-1 text-right font-medium">LTV</th>
                  <th className="pb-1 text-right font-medium">LTV:CAC</th>
                  <th className="pb-1 text-right font-medium">Payback</th>
                  <th className="pb-1 text-right font-medium">NRR</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {econ.motions.map((m) => (
                  <tr key={m.motion} className="border-t border-ink-800">
                    <td className="py-1 text-left">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{ background: MOTION_COLORS[m.motion] }}
                        />
                        {MOTION_LABELS[m.motion]}
                      </span>
                    </td>
                    <td className="py-1 text-right text-slate-500">
                      {percent(c.motionMix[m.motion])}
                    </td>
                    <td className="py-1 text-right text-slate-300">{number(m.customers, 1)}</td>
                    <td className="py-1 text-right text-slate-300">{money(m.cac)}</td>
                    <td className="py-1 text-right text-slate-300">{money(m.arpa)}</td>
                    <td className="py-1 text-right text-slate-300">{compactMoney(m.ltv)}</td>
                    <td
                      className={clsx("py-1 text-right", goodnessColor(m.ltvToCac, 1, 4))}
                    >
                      {multiple(m.ltvToCac)}
                    </td>
                    <td
                      className={clsx(
                        "py-1 text-right",
                        inverseGoodnessColor(m.paybackMonths, 8, 30)
                      )}
                    >
                      {months(m.paybackMonths)}
                    </td>
                    <td className={clsx("py-1 text-right", goodnessColor(m.nrr12, 0.75, 1.1))}>
                      {percent(m.nrr12)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <CohortChart
            cohort={econ.cohort}
            title="Cohort retention"
            subtitle={`${c.name} cohort · NRR ${percent(econ.nrr12)} at month 12`}
            height={190}
          />
          <RetentionWaterfall cohort={econ.cohort} />

          {/* Scaling character */}
          <div className="card">
            <h3 className="mb-1 text-xs font-semibold text-slate-200">Scaling character</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-2xs sm:grid-cols-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Saturation</span>
                <span className="tabular-nums text-slate-300">
                  {percent(econ.saturationLevel)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monthly ceiling</span>
                <span className="tabular-nums text-slate-300">
                  {number(c.saturation.K, 0)} cust.
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Half-saturation</span>
                <span className="tabular-nums text-slate-300">
                  {compactMoney(c.saturation.h)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ramp to steady state</span>
                <span className="tabular-nums text-slate-300">{c.rampMonths} mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Compounding</span>
                <span className="tabular-nums text-slate-300">
                  {c.monthlyCompounding > 0 ? `${percent(c.monthlyCompounding, 1)} / mo` : "none"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ceiling in 12 mo</span>
                <span className="tabular-nums text-slate-300">
                  {number(projectedCeiling(c, 12), 0)} cust.
                </span>
              </div>
            </div>
            <p className="mt-2 text-2xs leading-relaxed text-slate-500">
              {c.monthlyCompounding > 0
                ? `Spend here builds an owned asset: the ceiling grows ${percent(
                    c.monthlyCompounding,
                    1
                  )} per month, so a dollar today raises what tomorrow's dollar can earn.`
                : "This is rented attention — the ceiling does not move with sustained investment, so efficiency only degrades as spend rises."}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
