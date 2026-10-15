"use client";

import { useMemo, useState } from "react";
import { Bell, ChevronRight, TriangleAlert } from "lucide-react";
import clsx from "clsx";
import {
  SEVERITY_HEX,
  SEVERITY_LABEL,
  SEVERITY_RANK,
  SEVERITY_TEXT,
  projectionText,
  trendPerWeek,
  worstSeverity,
} from "@/lib/sensors";
import { eventAmount } from "@/lib/live";
import { useChannelAlerts, useGtm, useSensors } from "@/lib/store";
import { PortfolioEconomics } from "@/lib/types";
import { percent } from "@/lib/format";
import Sparkline from "./Sparkline";
import SeverityDot from "./SeverityDot";

const EVENT_COLOR: Record<string, string> = {
  won: "#a3e635",
  lost: "#fb7185",
  expanded: "#22d3ee",
  cost: "#fb923c",
  shock: "#fb7185",
  recovered: "#64748b",
};

export default function AlertCenter({ portfolio }: { portfolio: PortfolioEconomics }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"alerts" | "activity">("alerts");

  const sensors = useSensors(portfolio);
  const channelAlerts = useChannelAlerts(portfolio);
  const events = useGtm((s) => s.events);
  const shocks = useGtm((s) => s.shocks);
  const day = useGtm((s) => s.day);
  const selectChannel = useGtm((s) => s.selectChannel);

  const active = useMemo(
    () =>
      sensors
        .filter((r) => r.severity !== "ok")
        .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]),
    [sensors]
  );

  const count = active.length + channelAlerts.length;
  const worst = worstSeverity([...active, ...channelAlerts]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-2xs font-medium transition",
          count > 0
            ? "border-ink-600 bg-ink-850 text-slate-200 hover:bg-ink-800"
            : "border-ink-700 text-slate-500 hover:text-slate-300"
        )}
        title={
          count > 0
            ? `${count} unit-economics alert${count === 1 ? "" : "s"} — worst: ${SEVERITY_LABEL[worst]}`
            : "All unit economics within thresholds"
        }
      >
        <span className="relative">
          <Bell size={13} />
          {count > 0 && (
            <span
              className="absolute -right-1.5 -top-1.5 flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-bold text-ink-950"
              style={{ background: SEVERITY_HEX[worst] }}
            >
              {count}
            </span>
          )}
        </span>
        Sensors
        {count === 0 && <SeverityDot severity="ok" size={6} />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1.5 max-h-[72vh] w-[420px] overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 shadow-2xl">
            <div className="sticky top-0 flex items-center gap-2 border-b border-ink-800 bg-ink-900 px-3 py-2">
              <SeverityDot severity={worst} />
              <span className="text-xs font-semibold text-slate-200">
                {count === 0 ? "All sensors healthy" : `${count} alert${count === 1 ? "" : "s"}`}
              </span>
              <span className="ml-auto flex rounded-md border border-ink-700 bg-ink-950 p-0.5">
                {(["alerts", "activity"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={clsx(
                      "rounded px-2 py-0.5 text-2xs font-medium capitalize transition",
                      tab === t ? "bg-ink-700 text-slate-100" : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </span>
            </div>

            {tab === "alerts" ? (
              <div className="divide-y divide-ink-800">
                {shocks.length > 0 && (
                  <div className="bg-accent-rose/5 px-3 py-2">
                    {shocks.map((s) => (
                      <div key={s.id} className="flex items-start gap-2 py-0.5">
                        <TriangleAlert size={11} className="mt-0.5 shrink-0 text-accent-rose" />
                        <div className="min-w-0 flex-1">
                          <div className="text-2xs text-slate-300">{s.label}</div>
                          <div className="text-2xs text-slate-600">
                            {s.remaining}d of pressure remaining
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {count === 0 && (
                  <div className="px-3 py-6 text-center text-2xs text-slate-500">
                    Every tracked metric is inside its threshold, and none is trending toward one.
                  </div>
                )}

                {active.map((r) => {
                  const trend = trendPerWeek(r);
                  return (
                    <div key={r.def.id} className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <SeverityDot severity={r.severity} />
                        <span className="text-2xs font-medium text-slate-200">{r.def.label}</span>
                        <span className="text-2xs tabular-nums text-slate-400">{r.display}</span>
                        <span className="ml-auto flex items-center gap-1.5">
                          {trend !== null && (
                            <span
                              className={clsx(
                                "text-2xs tabular-nums",
                                r.deteriorating ? "text-accent-rose" : "text-accent-lime"
                              )}
                            >
                              {trend > 0 ? "▲" : "▼"} {percent(Math.abs(trend), 1)}/wk
                            </span>
                          )}
                          <Sparkline series={r.history} color={SEVERITY_HEX[r.severity]} />
                        </span>
                      </div>
                      <div className={clsx("mt-0.5 pl-4 text-2xs font-medium", SEVERITY_TEXT[r.severity])}>
                        {projectionText(r) ??
                          `${SEVERITY_LABEL[r.severity]} · threshold ${r.def.format(r.def.amber)}`}
                      </div>
                      <div className="pl-4 text-2xs leading-snug text-slate-500">{r.def.why}</div>
                    </div>
                  );
                })}

                {channelAlerts.length > 0 && (
                  <div className="bg-ink-950/60 px-3 py-1.5 text-2xs uppercase tracking-wider text-slate-600">
                    By channel
                  </div>
                )}
                {channelAlerts.map((a) => (
                  <button
                    key={a.channelId}
                    onClick={() => {
                      selectChannel(a.channelId);
                      setOpen(false);
                    }}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-ink-850"
                  >
                    <SeverityDot severity={a.severity} />
                    <div className="min-w-0 flex-1">
                      <div className="text-2xs font-medium text-slate-200">{a.channelName}</div>
                      <div className={clsx("text-2xs font-medium", SEVERITY_TEXT[a.severity])}>
                        {a.headline}
                      </div>
                      <div className="text-2xs leading-snug text-slate-500">{a.detail}</div>
                    </div>
                    <ChevronRight size={12} className="mt-0.5 shrink-0 text-slate-600" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-ink-800/60">
                {events.length === 0 && (
                  <div className="px-3 py-6 text-center text-2xs text-slate-500">
                    Nothing yet. Start the live tracker to watch spend, wins, losses and expansion
                    move the economics.
                  </div>
                )}
                {events.map((e) => {
                  const amount = eventAmount(e);
                  return (
                    <div key={e.id} className="flex items-center gap-2 px-3 py-1.5">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: EVENT_COLOR[e.kind] }}
                      />
                      <span className="w-8 shrink-0 text-2xs tabular-nums text-slate-600">
                        d{e.day}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-2xs text-slate-400">
                        {e.text}
                      </span>
                      {amount && (
                        <span
                          className={clsx(
                            "shrink-0 text-2xs tabular-nums",
                            e.mrr! >= 0 ? "text-accent-lime" : "text-accent-rose"
                          )}
                        >
                          {amount}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="sticky bottom-0 border-t border-ink-800 bg-ink-900 px-3 py-1.5 text-2xs text-slate-600">
              Day {day} · sensors fit a 14-day trend and flag a breach up to 30 days out
            </div>
          </div>
        </>
      )}
    </div>
  );
}
