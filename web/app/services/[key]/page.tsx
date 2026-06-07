"use client";

import useSWR from "swr";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Badge, JsonBlock, MetricCard, Progress, ServiceCell } from "@/components/UI";
import { fetcher } from "@/lib/api";
import { fmtCompact, fmtRelative, fmtTime } from "@/lib/format";
import type { EventRecord, Service, SyncTask } from "@/lib/types";

export default function ServiceDetailPage() {
  const { key } = useParams<{ key: string }>();
  const { data, error } = useSWR<{ service: Service; events: EventRecord[]; sync_tasks: SyncTask[] }>(`/api/services/${key}`, fetcher, { refreshInterval: 10000 });
  if (error) notFound();
  const s = data?.service;
  return (
    <Shell title={s?.name || "服务详情"} subtitle={s ? `${s.service_key} · ${s.type}` : "加载中"}>
      {s ? <div className={`card card-pad mb-20 ${s.status === "error" ? "card-error" : ""}`}><div className="row wrap"><ServiceCell name={s.name} sub={s.service_key} type={s.type} /><span className="spacer" /><Badge status={s.status} /></div><hr className="divider" /><p className="text-muted">{s.message || "暂无消息"}</p></div> : null}
      <div className="grid grid-4 mb-20">
        <MetricCard label="当前状态" value={s ? <Badge status={s.status} /> : "—"} tone={s?.status === "error" ? "red" : "blue"} />
        <MetricCard label="心跳超时" value={`${s?.heartbeat_timeout_sec || 90}s`} tone="cyan" />
        <MetricCard label="最近心跳" value={<span style={{ fontSize: 22 }}>{fmtRelative(s?.last_heartbeat_at)}</span>} tone="green" />
        <MetricCard label="关联任务" value={data?.sync_tasks?.length ?? "—"} tone="purple" />
      </div>
      <div className="cols-12">
        <div className="span-5 card card-pad"><div className="card-head"><h3>关联任务</h3></div>{data?.sync_tasks?.map((t) => <Link key={t.task_id} href={`/sync/${t.task_id}`} className="route-card mb-16"><div className="row"><span style={{ fontWeight: 600 }}>{t.name}</span><span className="spacer" /><Badge status={t.status} /></div><div className="progress-row mt-8"><Progress value={t.progress} /><span className="pct">{Math.round(t.progress || 0)}%</span></div><div className="text-muted mt-8">{fmtCompact(t.processed)} / {fmtCompact(t.total)}</div></Link>) || <div className="empty"><p>暂无任务</p></div>}</div>
        <div className="span-7 card card-pad"><div className="card-head"><h3>事件历史</h3><span className="sub">JSON 原文保留</span></div><div className="timeline">{data?.events?.map((e) => <div key={e.id} className={`tl-item ${e.level === "error" ? "error" : e.level === "success" ? "success" : "running"}`}><span className="tl-dot" /><div className="tl-head"><span className="tl-msg">{e.message || e.type}</span><span className="tl-time">{fmtTime(e.created_at)}</span></div><div className="tl-meta">{e.service_key} · {e.type} · {fmtRelative(e.created_at)}</div><div className="mt-12"><JsonBlock value={e.raw_payload} /></div></div>)}</div></div>
      </div>
    </Shell>
  );
}
