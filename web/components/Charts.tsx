import { useId } from "react";
import { toneColor } from "@/lib/format";

export function Sparkline({ series, color = "#3785ff", width = 120, height = 40 }: { series?: number[]; color?: string; width?: number; height?: number }) {
  const id = useId().replace(/:/g, "");
  if (!series?.length) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const pad = 3;
  const pts = series.map((v, i) => {
    const x = pad + (i / Math.max(1, series.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const gid = `g${id}`;
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L ${pts.at(-1)?.[0].toFixed(1)} ${height} L ${pts[0][0].toFixed(1)} ${height} Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.at(-1)?.[0]} cy={pts.at(-1)?.[1]} r="2.6" fill={color} />
    </svg>
  );
}

export function Donut({ segments, size = 168, stroke = 18 }: { segments: { value: number; color: string }[]; size?: number; stroke?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(120,150,200,0.1)" strokeWidth={stroke} />
      {segments.map((seg, i) => {
        const len = (seg.value / total) * circ;
        const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={stroke} strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`} />;
        offset += len;
        return el;
      })}
    </svg>
  );
}

export function LineChart({ series, color = "#3785ff", height = 140 }: { series?: number[]; color?: string; height?: number }) {
  if (!series?.length) return null;
  const w = 520;
  const h = height;
  const min = Math.min(...series, 0);
  const max = Math.max(...series);
  const range = max - min || 1;
  const padL = 8, padR = 8, padT = 12, padB = 18;
  const pts = series.map((v, i) => [padL + (i / Math.max(1, series.length - 1)) * (w - padL - padR), (h - padB) - ((v - min) / range) * (h - padT - padB)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {[0, 1, 2, 3].map((g) => <line key={g} x1={padL} y1={padT + (g / 3) * (h - padT - padB)} x2={w - padR} y2={padT + (g / 3) * (h - padT - padB)} stroke="rgba(120,150,200,0.1)" />)}
      <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.at(-1)?.[0]} cy={pts.at(-1)?.[1]} r="3.5" fill={color} />
    </svg>
  );
}

export function DualLine({ a, b }: { a?: number[]; b?: number[] }) {
  if (!a?.length && !b?.length) return null;
  const s1 = a?.length ? a : [0];
  const s2 = b?.length ? b : [0];
  const all = [...s1, ...s2];
  const min = Math.min(...all, 0);
  const max = Math.max(...all);
  const range = max - min || 1;
  const w = 560, h = 150, padL = 8, padR = 8, padT = 14, padB = 20;
  const mk = (s: number[]) => s.map((v, i) => [padL + (i / Math.max(1, s.length - 1)) * (w - padL - padR), (h - padB) - ((v - min) / range) * (h - padT - padB)] as const);
  const path = (p: readonly (readonly [number, number])[]) => p.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ");
  const p1 = mk(s1), p2 = mk(s2);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {[0, 1, 2, 3].map((g) => <line key={g} x1={padL} y1={padT + (g / 3) * (h - padT - padB)} x2={w - padR} y2={padT + (g / 3) * (h - padT - padB)} stroke="rgba(120,150,200,.1)" />)}
      <path d={path(p1)} fill="none" stroke={toneColor("blue")} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d={path(p2)} fill="none" stroke={toneColor("green")} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={p1.at(-1)?.[0]} cy={p1.at(-1)?.[1]} r="3.4" fill={toneColor("blue")} />
      <circle cx={p2.at(-1)?.[0]} cy={p2.at(-1)?.[1]} r="3.4" fill={toneColor("green")} />
    </svg>
  );
}
