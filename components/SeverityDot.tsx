"use client";

import { SEVERITY_HEX, Severity } from "@/lib/sensors";

export default function SeverityDot({
  severity,
  size = 7,
}: {
  severity: Severity;
  size?: number;
}) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: SEVERITY_HEX[severity],
        boxShadow: severity === "ok" ? undefined : `0 0 6px ${SEVERITY_HEX[severity]}99`,
      }}
    />
  );
}
