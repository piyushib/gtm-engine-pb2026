"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChannelEconomics } from "@/lib/types";
import { customersFromSpend, marginalCac } from "@/lib/model";
import { CHANNEL_COLORS, compactMoney, money } from "@/lib/format";

/**
 * The response curve for one channel, with its current operating point marked.
 * Reading it: the flatter the curve is under the marker, the more the next
 * dollar is wasted.
 */
export default function SaturationChart({ channels }: { channels: ChannelEconomics[] }) {
  const [mode, setMode] = useState<"customers" | "marginal">("marginal");
  const [focusId, setFocusId] = useState<string>(channels[0]?.channel.id ?? "");
  const focus = channels.find((c) => c.channel.id === focusId) ?? channels[0];

  const data = useMemo(() => {
    if (!focus) return [];
    const maxSpend = Math.max(focus.totalSpend * 3, focus.channel.saturation.h * 2);
    const points = [];
    for (let i = 0; i <= 60; i++) {
      const spend = (maxSpend / 60) * i;
      points.push({
        spend,
        customers: customersFromSpend(focus.channel.saturation, spend),
        marginal: Math.min(marginalCac(focus.channel.saturation, spend), focus.cac * 12),
      });
    }
    return points;
  }, [focus]);

  if (!focus) return null;
  const color = CHANNEL_COLORS[focus.channel.id] ?? "#22d3ee";

  return (
    <div className="card">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h3 className="text-xs font-semibold text-slate-200">Diminishing returns</h3>
          <p className="text-2xs text-slate-500">
            {focus.channel.name} is at {(focus.saturationLevel * 100).toFixed(0)}% of its ceiling ·
            next customer costs {money(focus.marginalCac)} vs {money(focus.cac)} average
          </p>
        </div>
        <div className="flex rounded-md border border-ink-700 bg-ink-900 p-0.5">
          {(
            [
              ["marginal", "Marginal CAC"],
              ["customers", "Volume"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={clsx(
                "rounded px-2 py-0.5 text-2xs font-medium transition",
                mode === m ? "bg-ink-700 text-slate-100" : "text-slate-500 hover:text-slate-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {channels.map((c) => (
          <button
            key={c.channel.id}
            onClick={() => setFocusId(c.channel.id)}
            className={clsx(
              "rounded border px-1.5 py-0.5 text-2xs transition",
              c.channel.id === focusId
                ? "border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan"
                : "border-ink-700 text-slate-500 hover:text-slate-300"
            )}
          >
            {c.channel.name}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 10, left: -14, bottom: 0 }}>
          <CartesianGrid stroke="#1f2735" vertical={false} />
          <XAxis
            dataKey="spend"
            tick={{ stroke: "#3d4a5e", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#1f2735" }}
            tickFormatter={(v) => compactMoney(v)}
            type="number"
            domain={[0, "dataMax"]}
          />
          <YAxis
            tick={{ stroke: "#3d4a5e", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) =>
              mode === "marginal" ? compactMoney(v) : v.toFixed(0)
            }
          />
          <Tooltip
            contentStyle={{
              background: "#10151e",
              border: "1px solid #2b3647",
              borderRadius: 6,
              fontSize: 11,
            }}
            labelFormatter={(v) => `${compactMoney(Number(v))} / mo spend`}
            formatter={(v: number) => [
              mode === "marginal" ? money(v) : v.toFixed(1),
              mode === "marginal" ? "Cost of next customer" : "Customers / mo",
            ]}
          />
          <Line
            type="monotone"
            dataKey={mode === "marginal" ? "marginal" : "customers"}
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
          <ReferenceDot
            x={focus.totalSpend}
            y={mode === "marginal" ? focus.marginalCac : focus.customers}
            r={4}
            fill="#fff"
            stroke={color}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-2xs text-slate-500">
        White dot is today&apos;s spend level. {focus.channel.blurb}
      </p>
    </div>
  );
}
