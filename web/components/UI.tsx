"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Bot,
  CheckCircle2,
  Database,
  Download,
  FileText,
  Globe,
  Inbox,
  KeyRound,
  Layers,
  RefreshCw,
  Search,
  Server,
  Shield,
  Upload,
  Zap
} from "lucide-react";
import { fmtBytes, statusTone, STATUS_LABEL, toneColor, TYPE_LABEL } from "@/lib/format";
import { Sparkline } from "./Charts";

export function Badge({ status, label }: { status: string; label?: string }) {
  const tone = statusTone(status);
  const pulse = status === "running" || status === "error";
  return (
    <span className={`badge st-${tone}`}>
      <span className={`dot ${pulse ? "pulse" : ""}`} />
      {label || STATUS_LABEL[status] || status}
    </span>
  );
}

export function Progress({ value, tone = "blue", large = false }: { value?: number | null; tone?: string; large?: boolean }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const fillTone = tone === "error" ? "red" : tone === "healthy" ? "green" : tone === "warning" ? "yellow" : tone === "running" ? "blue" : tone;
  return (
    <div className={`progress ${large ? "lg" : ""}`}>
      <div className={`fill ${fillTone} ${fillTone === "blue" || fillTone === "cyan" ? "animated" : ""}`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function MetricCard({
  label,
  value,
  note,
  tone = "blue",
  icon = "activity",
  series
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: string;
  icon?: string;
  series?: number[];
}) {
  return (
    <div className="card metric hoverable">
      <div className="metric-top">
        <div className={`metric-icon ic-${tone}`}>{pickIcon(icon, 20)}</div>
        <div className="flex-1">
          <div className="metric-label">{label}</div>
          <div className="metric-value">{value}</div>
          {note ? <div className="metric-note">{note}</div> : <div className="metric-note" aria-hidden="true">&nbsp;</div>}
        </div>
      </div>
      {series ? (
        <div className="spark">
          <Sparkline series={series} color={toneColor(tone)} width={120} height={40} />
        </div>
      ) : null}
    </div>
  );
}

export function TypeTag({ type }: { type: string }) {
  return <span className={`tag type-${type}`}>{TYPE_LABEL[type] || type}</span>;
}

export function CellIcon({ type, icon }: { type?: string; icon?: string }) {
  const tone = type === "api" ? "cyan" : type === "crawler" ? "purple" : type === "agent" ? "green" : type === "script" ? "yellow" : "blue";
  return <span className={`cell-ico ic-${tone}`}>{pickIcon(icon || typeIcon(type), 18)}</span>;
}

export function ServiceCell({ href, name, sub, type }: { href?: string; name: string; sub: string; type?: string }) {
  const inner = (
    <div className="cell-primary">
      <CellIcon type={type} />
      <div className="min-w-0">
        <div className="cell-title" title={name}>{name}</div>
        <div className="cell-key" title={sub}>{sub}</div>
      </div>
    </div>
  );
  return href ? (
    <Link className="route-card" href={href}>
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  return <pre className="codeblock json-pre">{JSON.stringify(value, null, 2)}</pre>;
}

export function Speed({ value, arrow }: { value?: number | null; arrow: "up" | "down" }) {
  if (!value) return <span className="text-dim">—</span>;
  return (
    <span className={arrow === "up" ? "t-green" : "t-blue"}>
      {arrow === "up" ? "↑" : "↓"}
      {fmtBytes(value)}/s
    </span>
  );
}

export function EmptyState({ title, description, icon = "inbox" }: { title?: string; description?: string; icon?: string }) {
  return (
    <div className="empty">
      {pickIcon(icon, 48)}
      {title ? <h4>{title}</h4> : null}
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function MetricSkeletonRow() {
  return (
    <div className="grid grid-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton skeleton-metric" />
      ))}
    </div>
  );
}

export function PageLoading({ label = "正在加载数据" }: { label?: string }) {
  return (
    <div className="page-stack" aria-busy="true" aria-label={label}>
      <MetricSkeletonRow />
      <div className="card card-pad loading-panel">
        <div className="skeleton skeleton-line lg" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
      </div>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination" aria-label="分页">
      <button className="btn btn-ghost btn-sm" type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        上一页
      </button>
      <span className="text-muted tabnum">第 {page} / {pages} 页 · 共 {total} 条</span>
      <button className="btn btn-ghost btn-sm" type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        下一页
      </button>
    </div>
  );
}

export function PageStack({ children }: { children: React.ReactNode }) {
  return <div className="page-stack">{children}</div>;
}

export function Toolbar({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="toolbar-row">
      <div className="chips">{left}</div>
      {right ? <div className="row gap-12">{right}</div> : null}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  count
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  count?: number | string;
}) {
  return (
    <button type="button" className={`chip ${active ? "active" : ""}`} onClick={onClick}>
      {children}
      {count != null ? <span className="count">{count}</span> : null}
    </button>
  );
}

export function pickIcon(name: string, size = 18) {
  const props = { size, strokeWidth: 2.2 };
  const icons: Record<string, React.ReactNode> = {
    activity: <Activity {...props} />,
    alert: <AlertTriangle {...props} />,
    download: <Download {...props} />,
    bot: <Bot {...props} />,
    checkCircle: <CheckCircle2 {...props} />,
    database: <Database {...props} />,
    file: <FileText {...props} />,
    globe: <Globe {...props} />,
    inbox: <Inbox {...props} />,
    key: <KeyRound {...props} />,
    layers: <Layers {...props} />,
    refresh: <RefreshCw {...props} />,
    search: <Search {...props} />,
    server: <Server {...props} />,
    shield: <Shield {...props} />,
    sync: <ArrowLeftRight {...props} />,
    upload: <Upload {...props} />,
    zap: <Zap {...props} />
  };
  return icons[name] || <Activity {...props} />;
}

function typeIcon(type?: string) {
  return type === "api" ? "globe" : type === "agent" ? "bot" : type === "script" ? "file" : type === "crawler" ? "activity" : "server";
}
