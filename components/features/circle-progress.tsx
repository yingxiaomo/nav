"use client";

// ── Circular Progress ──
export function CircleProgress({ percent, size = 72, stroke = 6, color, label, sub }: {
  percent: number; size?: number; stroke?: number; color: string; label: string; sub?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0 transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-border/60" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out" />
        </svg>
        <span className="text-lg font-bold tabular-nums" style={{ color }}>{percent}%</span>
      </div>
      <span className="text-[10px] font-medium" style={{ color }}>{label}</span>
      {sub && <span className="text-[9px] text-muted-foreground/60 mt-0.5">{sub}</span>}
    </div>
  );
}
