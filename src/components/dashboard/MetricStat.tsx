"use client";

interface MetricStatProps {
  done: number;
  total: number;
  label: string;
}

export function MetricStat({ done, total, label }: MetricStatProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ minWidth: 200 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
        <strong>{done}</strong> <span style={{ opacity: 0.6 }}>de</span> <strong>{total}</strong> {label}
      </div>
      <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: "var(--input-bg)", overflow: "hidden" }} aria-hidden>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--primary)",
            transition: "width 0.4s ease-out",
          }}
        />
      </div>
    </div>
  );
}
