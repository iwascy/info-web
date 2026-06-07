"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Grid2X2, List, Search, Trash2 } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Badge, MetricCard, Progress, ServiceCell, TypeTag } from "@/components/UI";
import { apiDelete, fetcher } from "@/lib/api";
import { fmtRelative, statusTone } from "@/lib/format";
import type { Service } from "@/lib/types";

const filters = ["all", "error", "warning", "running", "healthy", "unknown", "paused"];

export default function ServicesPage() {
  const { data, mutate } = useSWR<Service[]>("/api/services", fetcher, { refreshInterval: 10000 });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [grid, setGrid] = useState(false);
  const services = useMemo(() => (data || []).filter((s) => (filter === "all" || s.status === filter) && `${s.name} ${s.service_key}`.toLowerCase().includes(q.toLowerCase())), [data, filter, q]);
  const counts = Object.fromEntries(filters.map((f) => [f, f === "all" ? data?.length || 0 : data?.filter((s) => s.status === f).length || 0]));
  const hasPikpak = (data || []).some((s) => s.service_key.includes("pikpak"));
  async function remove(key: string) {
    if (confirm(`删除服务 ${key}？相关前端列表会立即移除。`)) {
      await apiDelete(`/api/services/${key}`);
      mutate();
    }
  }
  return (
    <Shell title="服务" subtitle="查看所有被监控服务，异常状态会自动置顶。">
      <div className="grid grid-4 mb-20">
        <MetricCard label="异常" value={counts.error} tone="red" icon="alert" />
        <MetricCard label="运行中" value={counts.running} tone="blue" icon="activity" />
        <MetricCard label="正常" value={counts.healthy} tone="green" icon="checkCircle" />
        <MetricCard label="未知" value={counts.unknown} tone="purple" icon="server" />
      </div>
      <div className="toolbar-row">
        <div className="chips">{filters.map((f) => <button key={f} className={`chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f === "all" ? "全部" : f}<span className="count">{counts[f]}</span></button>)}</div>
        <div className="row"><div className="search"><Search size={17} /><input placeholder="搜索服务名 / key" value={q} onChange={(e) => setQ(e.target.value)} /></div><button className="btn btn-ghost btn-icon" onClick={() => setGrid(!grid)} title="切换视图">{grid ? <List size={17} /> : <Grid2X2 size={17} />}</button></div>
      </div>
      {grid ? (
        services.length ? <div className="view-grid">{services.map((s) => <div key={s.service_key} className={`card card-pad hoverable ${s.status === "error" ? "card-error" : ""}`}><div className="row"><ServiceCell href={`/services/${s.service_key}`} name={s.name} sub={s.service_key} type={s.type} /><span className="spacer" /><Badge status={s.status} /></div><hr className="divider" /><div className="stat-grid"><div className="stat-box"><div className="k">类型</div><div className="v" style={{ fontSize: 16 }}><TypeTag type={s.type} /></div></div><div className="stat-box"><div className="k">最近心跳</div><div className="v" style={{ fontSize: 16 }}>{fmtRelative(s.last_heartbeat_at)}</div></div></div>{s.progress != null ? <div className="mt-16"><div className="progress-row"><Progress value={s.progress} tone={statusTone(s.status)} /><span className="pct">{s.progress}%</span></div></div> : null}</div>)}</div> : <div className="card card-pad"><div className="empty"><h4>暂无服务</h4><p>接入真实服务后会显示在这里</p></div></div>
      ) : (
        <div className="card card-pad">{services.length ? <div className="table-wrap"><table className="tbl"><thead><tr><th>服务</th><th>类型</th><th>状态</th><th>消息</th><th>进度</th><th>最近心跳</th><th /></tr></thead><tbody>{services.map((s) => <tr key={s.service_key} className={s.status === "error" ? "row-error" : ""}><td><ServiceCell href={`/services/${s.service_key}`} name={s.name} sub={s.service_key} type={s.type} /></td><td><TypeTag type={s.type} /></td><td><Badge status={s.status} /></td><td className="text-muted">{s.message || "—"}</td><td>{s.progress != null ? <div className="progress-row"><Progress value={s.progress} tone={statusTone(s.status)} /><span className="pct">{s.progress}%</span></div> : <span className="text-dim">—</span>}</td><td className="text-muted nowrap">{fmtRelative(s.last_heartbeat_at)}</td><td><button className="btn btn-danger btn-icon" onClick={() => remove(s.service_key)} title="删除"><Trash2 size={16} /></button></td></tr>)}</tbody></table></div> : <div className="empty"><h4>暂无服务</h4><p>接入真实服务后会显示在这里</p></div>}</div>
      )}
      {hasPikpak ? <div className="mt-20"><Link href="/services/pikpak-115" className="btn btn-primary">打开 PikPak → 115 专属页</Link></div> : null}
    </Shell>
  );
}
