"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CohortPoint } from "@/lib/types";

const AXIS = { stroke: "#3d4a5e", fontSize: 10 };

export default function CohortChart({
  cohort,
  title,
  subtitle,
  height = 220,
}: {
  cohort: CohortPoint[];
  title: string;
  subtitle?: string;
  height?: number;
}) {
  const data = cohort.map((p) => ({
    month: p.month,
    logo: p.logoSurvival * 100,
    grr: p.grossDollarRetention * 100,
    nrr: p.netDollarRetention * 100,
  }));

  return (
    <div className="card">
      <h3 className="text-xs font-semibold text-slate-200">{title}</h3>
      {subtitle && <p className="mb-2 text-2xs text-slate-500">{subtitle}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="#1f2735" vertical={false} />
          <XAxis
            dataKey="month"
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: "#1f2735" }}
            label={{ value: "months since acquisition", fontSize: 9, fill: "#64748b", dy: 12 }}
          />
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
            domain={[0, (max: number) => Math.max(120, Math.ceil(max / 20) * 20)]}
          />
          <ReferenceLine y={100} stroke="#3d4a5e" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{
              background: "#10151e",
              border: "1px solid #2b3647",
              borderRadius: 6,
              fontSize: 11,
            }}
            formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
            labelFormatter={(m) => `Month ${m}`}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
          <Line
            type="monotone"
            dataKey="nrr"
            name="Net dollar retention"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="grr"
            name="Gross dollar retention"
            stroke="#fbbf24"
            strokeWidth={1.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="logo"
            name="Logo survival"
            stroke="#fb7185"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
