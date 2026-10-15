"use client";

/** Minimal trend line for a sensor's rolling history. */
export default function Sparkline({
  series,
  color,
  width = 60,
  height = 16,
}: {
  series: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (series.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#1f2735"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || Math.abs(max) || 1;
  const pad = 1.5;
  const step = width / (series.length - 1);

  const points = series
    .map((v, i) => {
      const y = height - pad - ((v - min) / span) * (height - pad * 2);
      return `${(i * step).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const lastY =
    height - pad - ((series[series.length - 1] - min) / span) * (height - pad * 2);

  return (
    <svg width={width} height={height} aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.25} opacity={0.85} />
      <circle cx={width} cy={lastY} r={1.6} fill={color} />
    </svg>
  );
}
