"use client";

import { PortfolioEconomics, COST_KEYS, COST_LABELS } from "@/lib/types";
import { useActiveChannels, useGtm } from "@/lib/store";
import { compactMoney, money, months, multiple, percent, CHANNEL_COLORS } from "@/lib/format";
import DollarFlow from "./DollarFlow";
import AllocationPanel from "./AllocationPanel";
import CohortChart from "./charts/CohortChart";
import RetentionWaterfall from "./charts/RetentionWaterfall";
import SaturationChart from "./charts/SaturationChart";
import EfficiencyScatter from "./charts/EfficiencyScatter";

const COST_COLORS: Record<string, string> = {
  media: "#60a5fa",
  people: "#fb7185",
  content: "#fbbf24",
  tooling: "#a78bfa",
};

/** Where the budget goes by cost *type* rather than channel. */
function CostMix({ portfolio }: { portfolio: PortfolioEconomics }) {
  const channels = useActiveChannels();
  const totals = COST_KEYS.map((key) => ({
    key,
    label: COST_LABELS[key],
    value: channels.reduce((s, c) => s + c.spend[key], 0),
  }));
  const total = totals.reduce((s, t) => s + t.value, 0) || 1;

  return (
    <div className="card">
      <h3 className="text-xs font-semibold text-slate-200">Cost stack</h3>
      <p className="mb-3 text-2xs text-slate-500">
        What the dollar actually buys — only {percent(totals[0].value / total)} of it reaches a
        media auction
      </p>

      <div className="mb-3 flex h-5 overflow-hidden rounded">
        {totals.map((t) => (
          <div
            key={t.key}
            style={{ width: `${(t.value / total) * 100}%`, background: COST_COLORS[t.key] }}
            title={`${t.label}: ${compactMoney(t.value)}`}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        {totals.map((t) => (
          <div key={t.key} className="flex items-center gap-2 text-2xs">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ background: COST_COLORS[t.key] }}
            />
            <span className="text-slate-300">{t.label}</span>
            <span className="ml-auto tabular-nums text-slate-500">{compactMoney(t.value)}</span>
            <span className="w-10 text-right tabular-nums text-slate-400">
              {percent(t.value / total)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-ink-800 pt-2 text-2xs text-slate-500">
        Fully-loaded CAC {money(portfolio.cac)} vs {money(portfolio.cacPaidOnly)} on media alone —
        a {multiple(portfolio.cacPaidOnly > 0 ? portfolio.cac / portfolio.cacPaidOnly : 0)} gap
        between what the ad platform reports and what the customer truly cost.
      </div>
    </div>
  );
}

/** Per-channel contribution to spend vs contribution to lifetime gross profit. */
function ContributionBars({ portfolio }: { portfolio: PortfolioEconomics }) {
  const selectChannel = useGtm((s) => s.selectChannel);
  const totalGp = portfolio.channels.reduce((s, c) => s + c.grossProfit36, 0) || 1;
  const rows = [...portfolio.channels].sort(
    (a, b) => b.grossProfit36 / totalGp - b.spendShare - (a.grossProfit36 / totalGp - a.spendShare)
  );
  // Normalise bar widths to the largest share so the comparison stays legible.
  const maxShare = Math.max(
    ...rows.map((c) => Math.max(c.spendShare, c.grossProfit36 / totalGp)),
    0.01
  );

  return (
    <div className="card">
      <h3 className="text-xs font-semibold text-slate-200">Share of spend vs share of profit</h3>
      <p className="mb-3 text-2xs text-slate-500">
        Channels above the line earn more of the profit than they consume of the budget
      </p>
      <div className="space-y-2">
        {rows.map((c) => {
          const gpShare = c.grossProfit36 / totalGp;
          const lift = gpShare - c.spendShare;
          return (
            <button
              key={c.channel.id}
              onClick={() => selectChannel(c.channel.id)}
              className="w-full text-left"
            >
              <div className="flex items-center gap-2 text-2xs">
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ background: CHANNEL_COLORS[c.channel.id] ?? "#64748b" }}
                />
                <span className="w-36 shrink-0 truncate text-slate-300">{c.channel.name}</span>
                <div className="flex-1 space-y-0.5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                    <div
                      className="h-full rounded-full bg-slate-600"
                      style={{ width: `${(c.spendShare / maxShare) * 100}%` }}
                    />
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(gpShare / maxShare) * 100}%`,
                        background: CHANNEL_COLORS[c.channel.id] ?? "#64748b",
                      }}
                    />
                  </div>
                </div>
                <span
                  className={`w-14 shrink-0 text-right tabular-nums ${
                    lift >= 0 ? "text-accent-lime" : "text-accent-rose"
                  }`}
                >
                  {lift >= 0 ? "+" : ""}
                  {(lift * 100).toFixed(1)}pp
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3 text-2xs text-slate-600">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-4 rounded-full bg-slate-600" /> share of spend
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-4 rounded-full bg-accent-cyan" /> share of 36-mo gross profit
        </span>
      </div>
    </div>
  );
}

export default function DashboardView({ portfolio }: { portfolio: PortfolioEconomics }) {
  const best = [...portfolio.channels].sort(
    (a, b) => b.marginalReturnPerDollar - a.marginalReturnPerDollar
  );

  return (
    <div className="space-y-4">
      <DollarFlow portfolio={portfolio} />

      <div className="grid gap-4 lg:grid-cols-3">
        <CostMix portfolio={portfolio} />
        <ContributionBars portfolio={portfolio} />
        <AllocationPanel />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CohortChart
          cohort={portfolio.cohort}
          title="Portfolio cohort retention"
          subtitle={`Blended across all channels · NRR ${percent(
            portfolio.nrr12
          )} and GRR ${percent(portfolio.grr12)} at month 12`}
        />
        <RetentionWaterfall cohort={portfolio.cohort} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SaturationChart channels={portfolio.channels} />
        <EfficiencyScatter channels={portfolio.channels} />
      </div>

      <div className="card">
        <h3 className="text-xs font-semibold text-slate-200">Next dollar ranking</h3>
        <p className="mb-2 text-2xs text-slate-500">
          Lifetime gross profit returned by one more dollar, after diminishing returns
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {best.map((c, i) => (
            <div
              key={c.channel.id}
              className="flex items-center gap-2 rounded border border-ink-800 bg-ink-850/50 px-2 py-1.5 text-2xs"
            >
              <span className="w-4 text-slate-600">{i + 1}</span>
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ background: CHANNEL_COLORS[c.channel.id] ?? "#64748b" }}
              />
              <span className="truncate text-slate-300">{c.channel.name}</span>
              <span className="ml-auto shrink-0 font-semibold tabular-nums text-slate-100">
                {multiple(c.marginalReturnPerDollar, 2)}
              </span>
              <span className="w-16 shrink-0 text-right tabular-nums text-slate-600">
                {months(c.paybackMonths, 0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
