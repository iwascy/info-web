"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { Shell } from "@/components/Shell";
import { Badge, JsonBlock, MetricCard, Progress } from "@/components/UI";
import { LineChart } from "@/components/Charts";
import { fetcher } from "@/lib/api";
import { fmtCompact, fmtRelative } from "@/lib/format";
import type { SyncTask } from "@/lib/types";

export default function SyncDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: t } = useSWR<SyncTask>(`/api/sync-tasks/${id}`, fetcher, { refreshInterval: 10000 });
  return (
    <Shell title={t?.name || "同步详情"} subtitle={t ? `${t.service_key} · ${t.task_id}` : "加载中"}>
      <div className={`card card-pad mb-20 ${t?.status === "error" ? "card-error" : ""}`}><div className="row wrap"><div><h2>{t?.name || "—"}</h2><div className="cell-key">{t?.message || "等待数据"}</div></div><span className="spacer" /><Badge status={t?.status || "unknown"} /></div><div className="progress-row mt-20"><Progress value={t?.progress} large tone={t?.status === "error" ? "red" : "blue"} /><span className="pct">{Math.round(t?.progress || 0)}%</span></div></div>
      <div className="grid grid-4 mb-20"><MetricCard label="总量" value={fmtCompact(t?.total)} tone="blue" /><MetricCard label="已处理" value={fmtCompact(t?.processed)} tone="cyan" /><MetricCard label="成功" value={fmtCompact(t?.success)} tone="green" /><MetricCard label="失败" value={fmtCompact(t?.failed)} tone="red" /></div>
      <div className="card card-pad mb-20"><div className="card-head"><h3>阶段流</h3><span className="sub">五段流程</span></div><div className="stage-flow">{t?.stages?.map((s, i) => <div key={s.key} className={`stage-node ${s.status}`}>{i < (t.stages?.length || 0) - 1 ? <div className={`stage-line ${s.status === "done" ? "filled" : ""}`} /> : null}<div className="dot">{i + 1}</div><div className="s-name">{s.name}</div><div className="s-meta">{s.meta || s.status}</div></div>)}</div></div>
      <div className="cols-12"><div className="span-7 card card-pad"><div className="card-head"><h3>吞吐趋势</h3></div><LineChart series={t?.download_series || [9, 11, 10, 12, 13, 12, 14, 13, 12, 15, 13, 12]} /></div><div className="span-5 card card-pad"><div className="card-head"><h3>批次记录</h3></div><div className="table-wrap"><table className="tbl"><thead><tr><th>批次</th><th>总量</th><th>成功</th><th>失败</th><th>耗时</th></tr></thead><tbody>{t?.batches?.map((b) => <tr key={b.id}><td>{b.range}</td><td>{fmtCompact(b.total)}</td><td>{fmtCompact(b.success)}</td><td className="t-red">{fmtCompact(b.failed)}</td><td>{b.duration}</td></tr>)}</tbody></table></div></div></div>
      <div className="card card-pad mt-20"><div className="card-head"><h3>异常样本</h3></div>{t?.error_samples?.length ? t.error_samples.map((e) => <details key={e.id} className="mb-16"><summary className="clickable"><span className={`sev sev-${e.level === "error" ? "high" : "medium"}`}>{e.code}</span> {e.file} · {e.reason}</summary><div className="mt-12"><JsonBlock value={e.payload} /></div></details>) : <div className="empty"><p>暂无异常样本</p></div>}<div className="text-muted mt-16">最近更新：{fmtRelative(t?.updated_at)}</div></div>
    </Shell>
  );
}
