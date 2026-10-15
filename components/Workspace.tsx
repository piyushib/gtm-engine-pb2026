"use client";

import { Grid3x3, LayoutDashboard, RotateCcw, Wand2 } from "lucide-react";
import clsx from "clsx";
import { useGtm, usePortfolio } from "@/lib/store";
import KpiStrip from "./KpiStrip";
import AssumptionsBar from "./AssumptionsBar";
import SpreadsheetView from "./SpreadsheetView";
import DashboardView from "./DashboardView";
import ChannelDrawer from "./ChannelDrawer";
import AlertCenter from "./AlertCenter";
import AlertToasts from "./AlertToasts";
import LiveControls from "./LiveControls";

export default function Workspace() {
  const view = useGtm((s) => s.view);
  const setView = useGtm((s) => s.setView);
  const reset = useGtm((s) => s.reset);
  const optimize = useGtm((s) => s.applyOptimizedAllocation);
  const portfolio = usePortfolio();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-950/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <div className="mr-auto">
            <h1 className="text-sm font-semibold tracking-tight text-slate-100">
              GTM Unit Economics Engine
            </h1>
            <p className="text-2xs text-slate-500">
              Every dollar traced through channel → motion → cohort → retention
            </p>
          </div>

          <LiveControls />
          <AlertCenter portfolio={portfolio} />

          <button
            onClick={optimize}
            className="flex items-center gap-1.5 rounded-md border border-accent-cyan/40 bg-accent-cyan/10 px-2.5 py-1.5 text-2xs font-medium text-accent-cyan transition hover:bg-accent-cyan/20"
            title="Reallocate the same budget to equalise marginal return per dollar"
          >
            <Wand2 size={13} /> Optimize allocation
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 py-1.5 text-2xs text-slate-400 transition hover:bg-ink-850 hover:text-slate-200"
          >
            <RotateCcw size={13} /> Reset
          </button>

          <div className="flex rounded-md border border-ink-700 bg-ink-900 p-0.5">
            {(
              [
                ["sheet", "Spreadsheet", Grid3x3],
                ["dashboard", "Dashboard", LayoutDashboard],
              ] as const
            ).map(([mode, label, Icon]) => (
              <button
                key={mode}
                onClick={() => setView(mode)}
                className={clsx(
                  "flex items-center gap-1.5 rounded px-2.5 py-1 text-2xs font-medium transition",
                  view === mode
                    ? "bg-ink-700 text-slate-100"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>

        <KpiStrip portfolio={portfolio} />
        <AlertToasts />
      </header>

      <AssumptionsBar />

      <main className="px-5 py-4">
        {view === "sheet" ? (
          <SpreadsheetView portfolio={portfolio} />
        ) : (
          <DashboardView portfolio={portfolio} />
        )}
      </main>

      <ChannelDrawer portfolio={portfolio} />
    </div>
  );
}
