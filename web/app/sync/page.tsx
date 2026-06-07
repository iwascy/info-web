"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Search } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Badge, MetricCard, Progress } from "@/components/UI";
import { fetcher } from "@/lib/api";
import { fmtCompact, fmtRelative } from "@/lib/format";
import type { SyncTask } from "@/lib/types";

export default function SyncPage() {
  const { data } = useSWR<SyncTask[]>("/api/sync-tasks", fetcher, { refreshInterval: 10000 });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const tasks = useMemo(() => (data || []).filter((t) => (filter === "all" || t.status === filter) && `${t.name} ${t.task_id} ${t.service_key}`.toLowerCase().includes(q.toLowerCase())), [data, q, filter]);
  const hero = tasks.find((t) => t.status === "running") || tasks[0];
  return (
    <Shell title="同步任务" subtitle="所有数据同步、迁移、批处理任务的实时进度。">
      <div className="grid grid-4 mb-20">
        <MetricCard label="运行中" value={data?.filter((t) => t.status === "running").length || 0} tone="blue" icon="activity" />
        <MetricCard label="异常" value={data?.filter((t) => t.status === "error").length || 0} tone="red" icon="alert" />
        <MetricCard label="已完成" value={data?.filter((t) => t.status === "success").length || 0} tone="green" icon="checkCircle" />
        <MetricCard label="平均进度" value={`${Math.round((data || []).reduce((s, t) => s + (t.progress || 0), 0) / Math.max(1, data?.length || 1))}%`} tone="purple" icon="layers" />
      </div>
      {hero ? <Link href={hero.service_key.includes("pikpak") ? "/services/pikpak-115" : `/sync/${hero.task_id}`} className={`card card-pad hoverable route-card mb-20 ${hero.status === "error" ? "card-error" : ""}`}><div className="row wrap"><div><div className="text-muted">Hero Task</div><h2>{hero.name}</h2><div className="cell-key">{hero.service_key} · {hero.task_id}</div></div><span className="spacer" /><Badge status={hero.status} /></div><div className="progress-row mt-20"><Progress value={hero.progress} large tone={hero.status === "error" ? "red" : "blue"} /><span className="pct t-blue">{Math.round(hero.progress || 0)}%</span></div><div className="stat-grid mt-16"><div className="stat-box"><div className="k">阶段</div><div className="v">{hero.stage || "—"}</div></div><div className="stat-box"><div className="k">处理</div><div className="v">{fmtCompact(hero.processed)} / {fmtCompact(hero.total)}</div></div><div className="stat-box"><div className="k">最近更新</div><div className="v">{fmtRelative(hero.updated_at)}</div></div></div></Link> : null}
      <div className="toolbar-row"><div className="chips">{["all", "error", "running", "success", "paused"].map((f) => <button key={f} className={`chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f}</button>)}</div><div className="search"><Search size={17} /><input placeholder="搜索任务" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      <div className="card card-pad"><div className="table-wrap"><table className="tbl"><thead><tr><th>任务</th><th>服务</th><th>状态</th><th>阶段</th><th>进度</th><th>成功 / 失败</th><th>更新时间</th></tr></thead><tbody>{tasks.map((t) => <tr key={t.task_id} className={t.status === "error" ? "row-error" : ""}><td><Link href={t.service_key.includes("pikpak") ? "/services/pikpak-115" : `/sync/${t.task_id}`}><div className="cell-title">{t.name}</div><div className="cell-key">{t.task_id}</div></Link></td><td className="cell-key">{t.service_key}</td><td><Badge status={t.status} /></td><td>{t.stage || "—"}</td><td><div className="progress-row"><Progress value={t.progress} tone={t.status === "error" ? "red" : "blue"} /><span className="pct">{Math.round(t.progress || 0)}%</span></div></td><td className="mono">{fmtCompact(t.success)} / <span className="t-red">{fmtCompact(t.failed)}</span></td><td className="text-muted nowrap">{fmtRelative(t.updated_at)}</td></tr>)}</tbody></table></div></div>
    </Shell>
  );
}
