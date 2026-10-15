"use client";

import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  Cell,
} from "recharts";
import { ChannelEconomics } from "@/lib/types";
import { CHANNEL_COLORS, compactMoney, money, months, multiple, percent } from "@/lib/format";
import { useGtm } from "@/lib/store";

/**
 * Payback (x) against LTV:CAC (y), sized by spend. The useful read is the
 * bottom-right quadrant: channels absorbing real money while taking a long
 * time to pay back and returning little lifetime profit.
 */
export default function EfficiencyScatter({ channels }: { channels: ChannelEconomics[] }) {
  const selectChannel = useGtm((s) => s.selectChannel);

  const data = channels.map((c) => ({
    x: c.paybackMonths ?? 48,
    y: c.ltvToCac,
    z: c.totalSpend,
    name: c.channel.name,
    id: c.channel.id,
    cac: c.cac,
    nrr: c.nrr12,
    spend: c.totalSpend,
    neverPaysBack: c.paybackMonths === null,
  }));

  return (
    <div className="card">
      <h3 className="text-xs font-semibold text-slate-200">Efficiency map</h3>
      <p className="mb-2 text-2xs text-slate-500">
        Payback vs LTV:CAC, sized by monthly spend · bottom-right is where budget is trapped
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
          <CartesianGrid stroke="#1f2735" />
          <XAxis
            type="number"
            dataKey="x"
            name="Payback"
            tick={{ stroke: "#3d4a5e", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#1f2735" }}
            tickFormatter={(v) => `${v}mo`}
            label={{ value: "CAC payback", fontSize: 9, fill: "#64748b", dy: 12 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="LTV:CAC"
            tick={{ stroke: "#3d4a5e", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}x`}
          />
          <ZAxis type="number" dataKey="z" range={[60, 700]} />
          <ReferenceLine y={3} stroke="#3d4a5e" strokeDasharray="3 3" />
          <ReferenceLine x={18} stroke="#3d4a5e" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{
              background: "#10151e",
              border: "1px solid #2b3647",
              borderRadius: 6,
              fontSize: 11,
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-md border border-ink-600 bg-ink-850 p-2 text-2xs">
                  <div className="mb-1 font-semibold text-slate-100">{d.name}</div>
                  <div className="text-slate-400">
                    Spend {compactMoney(d.spend)} · CAC {money(d.cac)}
                  </div>
                  <div className="text-slate-400">
                    LTV:CAC {multiple(d.y)} · payback{" "}
                    {d.neverPaysBack ? "never" : months(d.x)}
                  </div>
                  <div className="text-slate-400">NRR {percent(d.nrr)}</div>
                </div>
              );
            }}
          />
          <Scatter
            data={data}
            onClick={(p: { id?: string }) => p?.id && selectChannel(p.id)}
            cursor="pointer"
          >
            {data.map((d) => (
              <Cell
                key={d.id}
                fill={CHANNEL_COLORS[d.id] ?? "#64748b"}
                fillOpacity={0.65}
                stroke={CHANNEL_COLORS[d.id] ?? "#64748b"}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-2xs text-slate-600">
        <span>Dashed lines: 3x LTV:CAC and 18-month payback guardrails</span>
      </div>
    </div>
  );
}
