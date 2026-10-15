"use client";

import { Fragment, useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import {
  ChannelEconomics,
  ChannelGroup,
  COST_KEYS,
  COST_LABELS,
  MOTION_LABELS,
  PortfolioEconomics,
} from "@/lib/types";
import { useGtm } from "@/lib/store";
import {
  CHANNEL_COLORS,
  compactMoney,
  goodnessColor,
  inverseGoodnessColor,
  money,
  months,
  multiple,
  number,
  parseMoneyInput,
  percent,
} from "@/lib/format";

const GROUP_ORDER: ChannelGroup[] = [
  "Paid",
  "Organic & AEO",
  "Outbound",
  "Partner",
  "Lifecycle",
];

/** Editable spend cell that accepts "45k", "$1.2m", "45,000". */
function SpendCell({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      className="sheet-input"
      value={draft ?? compactMoney(value)}
      onFocus={() => setDraft(String(Math.round(value)))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null) {
          const parsed = parseMoneyInput(draft);
          if (parsed !== null) onCommit(parsed);
        }
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function SaturationBar({ level }: { level: number }) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-ink-700">
        <div
          className={clsx(
            "h-full rounded-full",
            level > 0.6 ? "bg-accent-rose" : level > 0.4 ? "bg-accent-amber" : "bg-accent-lime"
          )}
          style={{ width: `${Math.min(100, level * 100)}%` }}
        />
      </div>
      <span className="w-7 text-2xs text-slate-500">{percent(level)}</span>
    </div>
  );
}

export default function SpreadsheetView({ portfolio }: { portfolio: PortfolioEconomics }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const disabled = useGtm((s) => s.disabled);
  const toggleChannel = useGtm((s) => s.toggleChannel);
  const setChannelSpend = useGtm((s) => s.setChannelSpend);
  const setCostLine = useGtm((s) => s.setCostLine);
  const selectChannel = useGtm((s) => s.selectChannel);
  const allChannels = useGtm((s) => s.channels);

  const byGroup = useMemo(() => {
    const map = new Map<ChannelGroup, ChannelEconomics[]>();
    for (const econ of portfolio.channels) {
      const list = map.get(econ.channel.group) ?? [];
      list.push(econ);
      map.set(econ.channel.group, list);
    }
    return map;
  }, [portfolio.channels]);

  const inactive = allChannels.filter((c) => disabled[c.id]);

  return (
    <div className="overflow-hidden rounded-lg border border-ink-800">
      <div className="max-h-[calc(100vh-240px)] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sheet-head sticky left-0 z-30 min-w-[240px] text-left">Channel</th>
              <th className="sheet-head text-right">Spend / mo</th>
              <th className="sheet-head text-right">Mix</th>
              <th className="sheet-head text-right">Saturation</th>
              <th className="sheet-head text-right">Customers</th>
              <th className="sheet-head text-right">CAC</th>
              <th className="sheet-head text-right">Paid CAC</th>
              <th className="sheet-head text-right">Marg. CAC</th>
              <th className="sheet-head text-right">ARPA</th>
              <th className="sheet-head text-right">New MRR</th>
              <th className="sheet-head text-right">LTV</th>
              <th className="sheet-head text-right">LTV:CAC</th>
              <th className="sheet-head text-right">Payback</th>
              <th className="sheet-head text-right">Logo ret. 12</th>
              <th className="sheet-head text-right">GRR 12</th>
              <th className="sheet-head text-right">NRR 12</th>
              <th className="sheet-head text-right">GP / $1</th>
              <th className="sheet-head text-right">Marg. ret.</th>
            </tr>
          </thead>

          {GROUP_ORDER.filter((g) => byGroup.has(g)).map((group) => {
            const rows = byGroup.get(group)!;
            const groupSpend = rows.reduce((s, r) => s + r.totalSpend, 0);
            const groupCustomers = rows.reduce((s, r) => s + r.customers, 0);
            const groupMrr = rows.reduce((s, r) => s + r.newMrr, 0);
            const groupGp12 = rows.reduce((s, r) => s + r.grossProfit12, 0);

            return (
              <tbody key={group}>
                <tr className="bg-ink-850/80">
                  <td className="sticky left-0 z-10 border-b border-r border-ink-800 bg-ink-850 px-2 py-1.5 text-2xs font-semibold uppercase tracking-wider text-slate-400">
                    {group}
                  </td>
                  <td className="sheet-cell text-slate-300">{compactMoney(groupSpend)}</td>
                  <td className="sheet-cell text-slate-500">
                    {percent(groupSpend / portfolio.totalSpend)}
                  </td>
                  <td className="sheet-cell" />
                  <td className="sheet-cell text-slate-300">{number(groupCustomers, 1)}</td>
                  <td className="sheet-cell text-slate-300">
                    {money(groupCustomers > 0 ? groupSpend / groupCustomers : 0)}
                  </td>
                  <td className="sheet-cell" colSpan={3} />
                  <td className="sheet-cell text-slate-300">{compactMoney(groupMrr)}</td>
                  <td className="sheet-cell" colSpan={6} />
                  <td className="sheet-cell text-slate-300">
                    ${(groupSpend > 0 ? groupGp12 / groupSpend : 0).toFixed(2)}
                  </td>
                  <td className="sheet-cell" />
                </tr>

                {rows.map((econ) => {
                  const c = econ.channel;
                  const isOpen = expanded[c.id];
                  return (
                    <Fragment key={c.id}>
                      <tr className="group hover:bg-ink-850/50">
                        <td className="sticky left-0 z-10 border-b border-r border-ink-800 bg-ink-900 px-2 py-1.5 group-hover:bg-ink-850">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() =>
                                setExpanded((p) => ({ ...p, [c.id]: !p[c.id] }))
                              }
                              className="text-slate-600 hover:text-slate-300"
                            >
                              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>
                            <span
                              className="h-2 w-2 shrink-0 rounded-sm"
                              style={{ background: CHANNEL_COLORS[c.id] ?? "#64748b" }}
                            />
                            <button
                              onClick={() => selectChannel(c.id)}
                              className="truncate text-left text-slate-200 hover:text-accent-cyan hover:underline"
                              title={c.blurb}
                            >
                              {c.name}
                            </button>
                            {c.isAgentic && (
                              <span title="AI-native GTM surface" className="shrink-0">
                                <Sparkles size={10} className="text-accent-cyan" />
                              </span>
                            )}
                            <button
                              onClick={() => toggleChannel(c.id)}
                              className="ml-auto hidden text-2xs text-slate-600 hover:text-accent-rose group-hover:block"
                              title="Remove from portfolio"
                            >
                              mute
                            </button>
                          </div>
                        </td>

                        <td className="sheet-cell p-0">
                          <SpendCell
                            value={econ.totalSpend}
                            onCommit={(v) => setChannelSpend(c.id, v)}
                          />
                        </td>
                        <td className="sheet-cell text-slate-500">{percent(econ.spendShare)}</td>
                        <td className="sheet-cell">
                          <SaturationBar level={econ.saturationLevel} />
                        </td>
                        <td className="sheet-cell text-slate-300">
                          {number(econ.customers, 1)}
                        </td>
                        <td
                          className={clsx(
                            "sheet-cell",
                            inverseGoodnessColor(econ.cac, 3000, 40000)
                          )}
                        >
                          {money(econ.cac)}
                        </td>
                        <td className="sheet-cell text-slate-500">
                          {econ.cacPaidOnly > 0 ? money(econ.cacPaidOnly) : "—"}
                        </td>
                        <td className="sheet-cell text-slate-400" title="Cost of the next customer">
                          {money(econ.marginalCac)}
                        </td>
                        <td className="sheet-cell text-slate-300">{money(econ.arpa)}</td>
                        <td className="sheet-cell text-slate-300">{compactMoney(econ.newMrr)}</td>
                        <td className="sheet-cell text-slate-300">{compactMoney(econ.ltv)}</td>
                        <td className={clsx("sheet-cell", goodnessColor(econ.ltvToCac, 1, 4))}>
                          {multiple(econ.ltvToCac)}
                        </td>
                        <td
                          className={clsx(
                            "sheet-cell",
                            inverseGoodnessColor(econ.paybackMonths, 8, 30)
                          )}
                        >
                          {months(econ.paybackMonths)}
                        </td>
                        <td className="sheet-cell text-slate-400">
                          {percent(econ.logoRetention12)}
                        </td>
                        <td className="sheet-cell text-slate-400">{percent(econ.grr12)}</td>
                        <td className={clsx("sheet-cell", goodnessColor(econ.nrr12, 0.75, 1.1))}>
                          {percent(econ.nrr12)}
                        </td>
                        <td className="sheet-cell text-slate-300">
                          ${econ.returnPerDollar.toFixed(2)}
                        </td>
                        <td
                          className={clsx(
                            "sheet-cell",
                            goodnessColor(econ.marginalReturnPerDollar, 0.8, 3)
                          )}
                          title="Lifetime gross profit returned by the NEXT dollar into this channel"
                        >
                          {multiple(econ.marginalReturnPerDollar, 2)}
                        </td>
                      </tr>

                      {isOpen && (
                        <>
                          {COST_KEYS.map((key) => (
                            <tr key={`${c.id}-${key}`} className="bg-ink-950/60 text-slate-500">
                              <td className="sticky left-0 z-10 border-b border-r border-ink-800 bg-ink-950 py-1 pl-10 pr-2 text-2xs">
                                {COST_LABELS[key]}
                              </td>
                              <td className="sheet-cell p-0 text-2xs">
                                <SpendCell
                                  value={c.spend[key]}
                                  onCommit={(v) => setCostLine(c.id, key, v)}
                                />
                              </td>
                              <td className="sheet-cell text-2xs">
                                {percent(c.spend[key] / econ.totalSpend)}
                              </td>
                              <td className="sheet-cell" colSpan={15} />
                            </tr>
                          ))}

                          {econ.motions.map((m) => (
                            <tr
                              key={`${c.id}-${m.motion}`}
                              className="bg-ink-950/30 text-slate-400"
                            >
                              <td className="sticky left-0 z-10 border-b border-r border-ink-800 bg-ink-950 py-1 pl-10 pr-2 text-2xs">
                                {MOTION_LABELS[m.motion]}
                              </td>
                              <td className="sheet-cell text-2xs">
                                {compactMoney(m.cac * m.customers)}
                              </td>
                              <td className="sheet-cell text-2xs">
                                {percent(c.motionMix[m.motion])}
                              </td>
                              <td className="sheet-cell" />
                              <td className="sheet-cell text-2xs">{number(m.customers, 1)}</td>
                              <td className="sheet-cell text-2xs">{money(m.cac)}</td>
                              <td className="sheet-cell" colSpan={2} />
                              <td className="sheet-cell text-2xs">{money(m.arpa)}</td>
                              <td className="sheet-cell text-2xs">{compactMoney(m.newMrr)}</td>
                              <td className="sheet-cell text-2xs">{compactMoney(m.ltv)}</td>
                              <td className="sheet-cell text-2xs">{multiple(m.ltvToCac)}</td>
                              <td className="sheet-cell text-2xs">{months(m.paybackMonths)}</td>
                              <td className="sheet-cell text-2xs">
                                {percent(m.logoRetention12)}
                              </td>
                              <td className="sheet-cell text-2xs">{percent(m.grr12)}</td>
                              <td className="sheet-cell text-2xs">{percent(m.nrr12)}</td>
                              <td className="sheet-cell" colSpan={2} />
                            </tr>
                          ))}
                        </>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            );
          })}

          <tfoot className="sticky bottom-0 z-20">
            <tr className="bg-ink-800 font-semibold text-slate-100">
              <td className="sticky left-0 z-30 border-r border-t border-ink-700 bg-ink-800 px-2 py-2">
                Portfolio
              </td>
              <td className="sheet-cell border-t border-ink-700">
                {compactMoney(portfolio.totalSpend)}
              </td>
              <td className="sheet-cell border-t border-ink-700">100%</td>
              <td className="sheet-cell border-t border-ink-700" />
              <td className="sheet-cell border-t border-ink-700">
                {number(portfolio.customers, 1)}
              </td>
              <td className="sheet-cell border-t border-ink-700">{money(portfolio.cac)}</td>
              <td className="sheet-cell border-t border-ink-700">
                {money(portfolio.cacPaidOnly)}
              </td>
              <td className="sheet-cell border-t border-ink-700" />
              <td className="sheet-cell border-t border-ink-700">{money(portfolio.arpa)}</td>
              <td className="sheet-cell border-t border-ink-700">
                {compactMoney(portfolio.newMrr)}
              </td>
              <td className="sheet-cell border-t border-ink-700">
                {compactMoney(portfolio.ltv)}
              </td>
              <td className="sheet-cell border-t border-ink-700">
                {multiple(portfolio.ltvToCac)}
              </td>
              <td className="sheet-cell border-t border-ink-700">
                {months(portfolio.paybackMonths)}
              </td>
              <td className="sheet-cell border-t border-ink-700">
                {percent(portfolio.logoRetention12)}
              </td>
              <td className="sheet-cell border-t border-ink-700">{percent(portfolio.grr12)}</td>
              <td className="sheet-cell border-t border-ink-700">{percent(portfolio.nrr12)}</td>
              <td className="sheet-cell border-t border-ink-700">
                ${portfolio.returnPerDollar.toFixed(2)}
              </td>
              <td className="sheet-cell border-t border-ink-700" />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-ink-800 bg-ink-900/50 px-3 py-2 text-2xs text-slate-600">
        <span>
          Type in any spend cell — <span className="text-slate-400">45k</span>,{" "}
          <span className="text-slate-400">$1.2m</span> — and the whole model recomputes. Expand a
          row for its cost stack and motion split.
        </span>
        {inactive.length > 0 && (
          <span className="ml-auto flex items-center gap-2">
            Muted:
            {inactive.map((c) => (
              <button
                key={c.id}
                onClick={() => toggleChannel(c.id)}
                className="chip hover:border-accent-cyan/50 hover:text-accent-cyan"
              >
                {c.name} +
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
