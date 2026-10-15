"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { MOTION_IDS, MOTION_LABELS, MotionId, PortfolioEconomics } from "@/lib/types";
import { CHANNEL_COLORS, MOTION_COLORS, compactMoney, percent } from "@/lib/format";
import { useGtm } from "@/lib/store";

// Wide viewBox keeps the rendered height reasonable, since the SVG scales to
// container width at a fixed aspect ratio.
const W = 1500;
const BAND = 26;
const GAP = 1.5;
const Y_SPEND = 34;
const Y_MOTION = 190;
const Y_RETURN = 346;

/** Vertical ribbon between two horizontal segments. */
function ribbon(x0: number, w0: number, x1: number, w1: number, yTop: number, yBot: number) {
  const mid = (yTop + yBot) / 2;
  return [
    `M ${x0} ${yTop}`,
    `C ${x0} ${mid} ${x1} ${mid} ${x1} ${yBot}`,
    `L ${x1 + w1} ${yBot}`,
    `C ${x1 + w1} ${mid} ${x0 + w0} ${mid} ${x0 + w0} ${yTop}`,
    "Z",
  ].join(" ");
}

interface Seg {
  id: string;
  label: string;
  color: string;
  x: number;
  w: number;
  value: number;
  share: number;
}

function layout(
  items: { id: string; label: string; color: string; value: number }[],
  width: number
): Seg[] {
  const total = items.reduce((s, i) => s + i.value, 0);
  const usable = width - GAP * Math.max(0, items.length - 1);
  let cursor = 0;
  return items.map((item) => {
    const share = total > 0 ? item.value / total : 0;
    const w = usable * share;
    const seg: Seg = { ...item, x: cursor, w, value: item.value, share };
    cursor += w + GAP;
    return seg;
  });
}

export default function DollarFlow({ portfolio }: { portfolio: PortfolioEconomics }) {
  const [horizon, setHorizon] = useState<12 | 36>(36);
  const [hover, setHover] = useState<string | null>(null);
  const selectChannel = useGtm((s) => s.selectChannel);

  const model = useMemo(() => {
    const channels = [...portfolio.channels].sort((a, b) => b.totalSpend - a.totalSpend);

    const spendSegs = layout(
      channels.map((c) => ({
        id: c.channel.id,
        label: c.channel.name,
        color: CHANNEL_COLORS[c.channel.id] ?? "#64748b",
        value: c.totalSpend,
      })),
      W
    );

    // Spend routed into each motion, using the model's effort-weighted split.
    const motionSpend: Record<MotionId, number> = {
      selfServe: 0,
      salesAssisted: 0,
      enterprise: 0,
    };
    const motionReturn: Record<MotionId, number> = {
      selfServe: 0,
      salesAssisted: 0,
      enterprise: 0,
    };
    for (const c of channels) {
      for (const m of c.motions) {
        motionSpend[m.motion] += m.cac * m.customers;
        const gp = m.cohort[Math.min(horizon, m.cohort.length - 1)].cumGrossProfit;
        motionReturn[m.motion] += gp * m.customers;
      }
    }

    const motionSegs = layout(
      MOTION_IDS.map((m) => ({
        id: m,
        label: MOTION_LABELS[m],
        color: MOTION_COLORS[m],
        value: motionSpend[m],
      })),
      W
    );

    const returnSegs = layout(
      MOTION_IDS.map((m) => ({
        id: `ret-${m}`,
        label: MOTION_LABELS[m],
        color: MOTION_COLORS[m],
        value: motionReturn[m],
      })),
      W
    );

    // Channel → motion ribbons, packed within both bands.
    const motionCursor: Record<string, number> = {};
    const links: { path: string; color: string; channelId: string; motion: MotionId }[] = [];
    for (const seg of spendSegs) {
      const econ = channels.find((c) => c.channel.id === seg.id)!;
      const channelSpend = econ.totalSpend || 1;
      let localCursor = 0;
      for (const m of econ.motions) {
        const spend = m.cac * m.customers;
        if (!Number.isFinite(spend) || spend <= 0) continue;
        const w0 = seg.w * (spend / channelSpend);
        const motionSeg = motionSegs.find((s) => s.id === m.motion)!;
        const totalForMotion = motionSpend[m.motion] || 1;
        const w1 = motionSeg.w * (spend / totalForMotion);
        const x1 = motionSeg.x + (motionCursor[m.motion] ?? 0);
        links.push({
          path: ribbon(seg.x + localCursor, w0, x1, w1, Y_SPEND + BAND, Y_MOTION),
          color: seg.color,
          channelId: seg.id,
          motion: m.motion,
        });
        motionCursor[m.motion] = (motionCursor[m.motion] ?? 0) + w1;
        localCursor += w0;
      }
    }

    // Motion → return ribbons (same motion, re-scaled to the return band).
    const returnLinks = MOTION_IDS.map((m) => {
      const from = motionSegs.find((s) => s.id === m)!;
      const to = returnSegs.find((s) => s.id === `ret-${m}`)!;
      return {
        path: ribbon(from.x, from.w, to.x, to.w, Y_MOTION + BAND, Y_RETURN),
        color: MOTION_COLORS[m],
        motion: m,
      };
    });

    const totalReturn = MOTION_IDS.reduce((s, m) => s + motionReturn[m], 0);

    return {
      spendSegs,
      motionSegs,
      returnSegs,
      links,
      returnLinks,
      motionSpend,
      motionReturn,
      totalReturn,
      multipleOnSpend: portfolio.totalSpend > 0 ? totalReturn / portfolio.totalSpend : 0,
    };
  }, [portfolio, horizon]);

  const dim = (active: boolean) => (hover && !active ? 0.1 : hover ? 0.75 : 0.45);

  return (
    <div className="card">
      <div className="mb-1 flex items-center gap-3">
        <div>
          <h2 className="text-xs font-semibold text-slate-200">Where the dollar goes</h2>
          <p className="text-2xs text-slate-500">
            $1.00 of GTM spend → channels → motions → gross profit returned over {horizon} months
          </p>
        </div>
        <div className="ml-auto flex rounded-md border border-ink-700 bg-ink-900 p-0.5">
          {([12, 36] as const).map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={clsx(
                "rounded px-2 py-0.5 text-2xs font-medium transition",
                horizon === h ? "bg-ink-700 text-slate-100" : "text-slate-500 hover:text-slate-300"
              )}
            >
              {h} mo
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} 420`} className="w-full" style={{ minHeight: 300 }}>
        {/* Ribbons */}
        <g>
          {model.links.map((l, i) => (
            <path
              key={i}
              d={l.path}
              fill={l.color}
              opacity={dim(hover === l.channelId || hover === l.motion)}
            />
          ))}
          {model.returnLinks.map((l, i) => (
            <path key={i} d={l.path} fill={l.color} opacity={dim(hover === l.motion)} />
          ))}
        </g>

        {/* Spend band */}
        {model.spendSegs.map((s) => (
          <g
            key={s.id}
            onMouseEnter={() => setHover(s.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => selectChannel(s.id)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={s.x}
              y={Y_SPEND}
              width={Math.max(0, s.w)}
              height={BAND}
              fill={s.color}
              opacity={hover && hover !== s.id ? 0.35 : 1}
              rx={2}
            />
            {s.w > 70 && (
              <>
                <text
                  x={s.x + 4}
                  y={Y_SPEND + 11}
                  className="fill-ink-950"
                  style={{ fontSize: 9, fontWeight: 700 }}
                >
                  {percent(s.share)}
                </text>
                <text
                  x={s.x + 4}
                  y={Y_SPEND + 21}
                  className="fill-ink-950/80"
                  style={{ fontSize: 8 }}
                >
                  {s.label.length > s.w / 4.6 ? s.label.slice(0, Math.floor(s.w / 4.6)) : s.label}
                </text>
              </>
            )}
          </g>
        ))}

        {/* Motion band */}
        {model.motionSegs.map((s) => (
          <g
            key={s.id}
            onMouseEnter={() => setHover(s.id)}
            onMouseLeave={() => setHover(null)}
          >
            <rect
              x={s.x}
              y={Y_MOTION}
              width={Math.max(0, s.w)}
              height={BAND}
              fill={s.color}
              opacity={hover && hover !== s.id ? 0.35 : 1}
              rx={2}
            />
            {s.w > 120 && (
              <>
                <text
                  x={s.x + 5}
                  y={Y_MOTION + 11}
                  className="fill-ink-950"
                  style={{ fontSize: 9, fontWeight: 700 }}
                >
                  {s.label} · {percent(s.share)}
                </text>
                <text
                  x={s.x + 5}
                  y={Y_MOTION + 21}
                  className="fill-ink-950/80"
                  style={{ fontSize: 8 }}
                >
                  {compactMoney(s.value)} of spend
                </text>
              </>
            )}
          </g>
        ))}

        {/* Return band */}
        {model.returnSegs.map((s) => {
          const motion = s.id.replace("ret-", "") as MotionId;
          const spendShare =
            model.motionSegs.find((m) => m.id === motion)?.share ?? 0;
          const lift = s.share - spendShare;
          return (
            <g
              key={s.id}
              onMouseEnter={() => setHover(motion)}
              onMouseLeave={() => setHover(null)}
            >
              <rect
                x={s.x}
                y={Y_RETURN}
                width={Math.max(0, s.w)}
                height={BAND}
                fill={s.color}
                opacity={hover && hover !== motion ? 0.35 : 1}
                rx={2}
              />
              {s.w > 120 && (
                <>
                  <text
                    x={s.x + 5}
                    y={Y_RETURN + 11}
                    className="fill-ink-950"
                    style={{ fontSize: 9, fontWeight: 700 }}
                  >
                    {s.label} · {percent(s.share)}
                  </text>
                  <text
                    x={s.x + 5}
                    y={Y_RETURN + 21}
                    className="fill-ink-950/80"
                    style={{ fontSize: 8 }}
                  >
                    {compactMoney(s.value)} GP ({lift >= 0 ? "+" : ""}
                    {(lift * 100).toFixed(0)}pp vs spend)
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Stage labels last, so ribbons never paint over them. */}
        {(
          [
            [Y_SPEND, `$1.00 spent · ${compactMoney(portfolio.totalSpend)}/mo`],
            [Y_MOTION, "Routed into motions"],
            [
              Y_RETURN,
              `$${model.multipleOnSpend.toFixed(2)} returned · ${compactMoney(
                model.totalReturn
              )} gross profit`,
            ],
          ] as [number, string][]
        ).map(([y, label]) => (
          <text
            key={label}
            x={2}
            y={y - 7}
            className="fill-slate-400"
            style={{ fontSize: 10, fontWeight: 600, paintOrder: "stroke" }}
            stroke="#0b0f16"
            strokeWidth={3}
            strokeLinejoin="round"
          >
            {label}
          </text>
        ))}
      </svg>

      <p className="mt-1 text-2xs text-slate-500">
        Band widths are shares, not absolute dollars — the reordering between the spend band and
        the return band is the signal. Hover to isolate a flow, click a channel to drill in.
      </p>
    </div>
  );
}
