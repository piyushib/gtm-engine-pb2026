"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CohortPoint } from "@/lib/types";

/**
 * Decomposes month-12 net dollar retention into its drivers. The point of the
 * chart is that NRR is a net of three independent forces — a business with
 * 105% NRR and 18% gross churn is not the same business as one with 105% NRR
 * and 4% gross churn.
 */
export default function RetentionWaterfall({
  cohort,
  month = 12,
}: {
  cohort: CohortPoint[];
  month?: number;
}) {
  const point = cohort[Math.min(month, cohort.length - 1)];

  // All three deltas are measured on the dollar-weighted base so they
  // reconcile exactly: dollarSurvival − contraction + expansion = NRR.
  const churned = 1 - point.dollarSurvival;
  const contraction = point.dollarSurvival - point.grossDollarRetention;
  const expansion = point.netDollarRetention - point.grossDollarRetention;

  // `color` rather than `fill`: recharts treats a `fill` key on a data row as a
  // per-row override, which would make the invisible riser bar visible.
  const steps = [
    { name: "Starting ARR", value: 1, base: 0, color: "#3d4a5e", delta: false },
    { name: "Churn", value: churned, base: point.dollarSurvival, color: "#fb7185", delta: true },
    {
      name: "Contraction",
      value: contraction,
      base: point.grossDollarRetention,
      color: "#fbbf24",
      delta: true,
    },
    {
      name: "Expansion",
      value: expansion,
      base: point.grossDollarRetention,
      color: "#a3e635",
      delta: true,
    },
    {
      name: `NRR @ ${month}mo`,
      value: point.netDollarRetention,
      base: 0,
      color: "#22d3ee",
      delta: false,
    },
  ];

  const data = steps.map((s) => ({
    ...s,
    pct: s.value * 100,
    basePct: s.base * 100,
    label: `${s.delta ? (s.name === "Expansion" ? "+" : "−") : ""}${(s.value * 100).toFixed(1)}%`,
  }));

  return (
    <div className="card">
      <h3 className="text-xs font-semibold text-slate-200">What NRR is made of</h3>
      <p className="mb-2 text-2xs text-slate-500">
        Cohort revenue at month {month}, decomposed into churn, contraction and expansion
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 16, right: 8, left: -22, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ stroke: "none", fill: "#94a3b8", fontSize: 9 }}
            tickLine={false}
            axisLine={{ stroke: "#1f2735" }}
            interval={0}
          />
          <YAxis
            tick={{ stroke: "#3d4a5e", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: "#10151e",
              border: "1px solid #2b3647",
              borderRadius: 6,
              fontSize: 11,
            }}
            formatter={(_v, _n, item) => [item.payload.label, item.payload.name]}
          />
          {/* Invisible riser so each bar floats at its step height. */}
          <Bar dataKey="basePct" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="pct" stackId="w" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
            <LabelList
              dataKey="label"
              position="top"
              style={{ fill: "#94a3b8", fontSize: 9 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
