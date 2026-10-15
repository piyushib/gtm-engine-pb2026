export function money(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function compactMoney(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function percent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function multiple(value: number, digits = 1): string {
  if (!Number.isFinite(value) || value === 0) return "—";
  return `${value.toFixed(digits)}x`;
}

export function months(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "never";
  return `${value.toFixed(digits)} mo`;
}

export function number(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Parse loosely-typed spreadsheet input: "$1.2k", "45,000", "1.2m". */
export function parseMoneyInput(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const match = cleaned.match(/^(-?\d*\.?\d+)([km])?$/);
  if (!match) return null;
  const base = parseFloat(match[1]);
  if (!Number.isFinite(base)) return null;
  const scale = match[2] === "k" ? 1_000 : match[2] === "m" ? 1_000_000 : 1;
  return Math.max(0, base * scale);
}

/** Red → amber → green scale for "higher is better" metrics. */
export function goodnessColor(value: number, bad: number, good: number): string {
  if (!Number.isFinite(value)) return "text-ink-500";
  const t = Math.max(0, Math.min(1, (value - bad) / (good - bad)));
  if (t < 0.34) return "text-accent-rose";
  if (t < 0.67) return "text-accent-amber";
  return "text-accent-lime";
}

/** Same scale for "lower is better" metrics such as CAC or payback. */
export function inverseGoodnessColor(value: number | null, good: number, bad: number): string {
  if (value === null || !Number.isFinite(value)) return "text-accent-rose";
  const t = Math.max(0, Math.min(1, (value - good) / (bad - good)));
  if (t < 0.34) return "text-accent-lime";
  if (t < 0.67) return "text-accent-amber";
  return "text-accent-rose";
}

export const CHANNEL_COLORS: Record<string, string> = {
  "paid-search": "#60a5fa",
  "paid-social": "#818cf8",
  "seo-content": "#34d399",
  aeo: "#22d3ee",
  "agentic-outbound": "#a78bfa",
  "human-outbound": "#fb7185",
  "partner-marketplace": "#fbbf24",
  "community-events": "#f472b6",
  "lifecycle-plg": "#a3e635",
};

export const MOTION_COLORS: Record<string, string> = {
  selfServe: "#a3e635",
  salesAssisted: "#22d3ee",
  enterprise: "#a78bfa",
};
