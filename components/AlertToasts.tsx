"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { SEVERITY_HEX, SEVERITY_LABEL } from "@/lib/sensors";
import { Toast, useGtm } from "@/lib/store";

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (key: string) => void }) {
  useEffect(() => {
    const id = setTimeout(() => onDismiss(toast.key), 9000);
    return () => clearTimeout(id);
  }, [toast.key, onDismiss]);

  return (
    <div
      className="pointer-events-auto w-[320px] overflow-hidden rounded-lg border bg-ink-850 shadow-2xl"
      style={{ borderColor: `${SEVERITY_HEX[toast.severity]}66` }}
    >
      <div className="h-0.5 w-full" style={{ background: SEVERITY_HEX[toast.severity] }} />
      <div className="flex items-start gap-2 px-3 py-2">
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full"
          style={{
            background: SEVERITY_HEX[toast.severity],
            boxShadow: `0 0 8px ${SEVERITY_HEX[toast.severity]}`,
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-2xs font-bold uppercase tracking-wider"
              style={{ color: SEVERITY_HEX[toast.severity] }}
            >
              {SEVERITY_LABEL[toast.severity]}
            </span>
            <span className="text-2xs text-slate-600">day {toast.day}</span>
          </div>
          <div className="text-xs font-semibold text-slate-100">{toast.title}</div>
          <div className="mt-0.5 text-2xs leading-snug text-slate-400">{toast.body}</div>
        </div>
        <button
          onClick={() => onDismiss(toast.key)}
          className="shrink-0 text-slate-600 transition hover:text-slate-300"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

/**
 * Anchored to the header's bottom-right so notifications always appear in the
 * top corner regardless of how tall the header grows.
 */
export default function AlertToasts() {
  const toasts = useGtm((s) => s.toasts);
  const dismissToast = useGtm((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none absolute right-4 top-full z-[55] mt-2 flex flex-col gap-1.5">
      {toasts.map((t) => (
        <ToastCard key={t.key} toast={t} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
