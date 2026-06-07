"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Shell } from "@/components/Shell";
import { Badge, MetricCard } from "@/components/UI";
import { apiPost, fetcher } from "@/lib/api";
import { fmtRelative } from "@/lib/format";
import type { Alert } from "@/lib/types";

export default function AlertsPage() {
  const { data, mutate } = useSWR<Alert[]>("/api/alerts?status=all", fetcher, { refreshInterval: 10000 });
  const [filter, setFilter] = useState("all");
  const alerts = useMemo(() => (data || []).filter((a) => filter === "all" || a.status === filter || a.severity === filter), [data, filter]);
  async function act(id: number, action: "resolve" | "mute") {
    await apiPost(`/api/alerts/${id}/${action}`);
    mutate();
  }
  async function resolveAll() {
    if (!confirm("恢复所有触发中的告警？")) return;
    await apiPost("/api/alerts/resolve-all");
    mutate();
  }
  return (
    <Shell title="告警" subtitle="按严重度排序，触发中的告警优先处理。">
      <div className="grid grid-4 mb-20"><MetricCard label="触发中" value={data?.filter((a) => a.status === "firing").length || 0} tone="red" icon="alert" /><MetricCard label="高严重度" value={data?.filter((a) => a.severity === "high").length || 0} tone="yellow" /><MetricCard label="已恢复" value={data?.filter((a) => a.status === "resolved").length || 0} tone="green" /><MetricCard label="已静默" value={data?.filter((a) => a.status === "muted").length || 0} tone="purple" /></div>
      <div className="toolbar-row"><div className="chips">{["all", "firing", "resolved", "muted", "high", "medium", "low"].map((f) => <button key={f} className={`chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f}</button>)}</div><button className="btn btn-ghost" onClick={resolveAll}>全部恢复</button></div>
      <div className="grid gap-12">{alerts.map((a) => <div key={a.id} className={`card card-pad hoverable ${a.status === "firing" ? "card-error" : ""}`}><div className="row wrap"><span className={`sev sev-${a.severity}`}>{a.severity}</span><div className="flex-1"><div style={{ fontWeight: 700, fontSize: 16 }}>{a.title}</div><div className="text-muted">{a.service_key}{a.task_id ? ` · ${a.task_id}` : ""} · {fmtRelative(a.triggered_at)}</div></div><Badge status={a.status} /></div><p className="text-muted mt-12">{a.message}</p>{a.status === "firing" ? <div className="row mt-16"><button className="btn btn-primary" onClick={() => act(a.id, "resolve")}>恢复</button><button className="btn btn-ghost" onClick={() => act(a.id, "mute")}>静默</button></div> : null}</div>)}</div>
    </Shell>
  );
}
