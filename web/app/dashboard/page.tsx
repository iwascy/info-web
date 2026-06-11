"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Badge, MetricCard, Progress, ServiceCell, TypeTag } from "@/components/UI";
import { Donut, Sparkline } from "@/components/Charts";
import { fetcher } from "@/lib/api";
import { fmtBytes, fmtCompact, fmtRelative, statusTone } from "@/lib/format";
import type { Dashboard } from "@/lib/types";

export default function DashboardPage() {
  const { data } = useSWR<Dashboard>("/api/dashboard", fetcher, { refreshInterval: 10000 });
  const d = data;
  const uptime = d?.uptime_pct == null ? "—" : `${d.uptime_pct}%`;
  const segs = [
    { label: "正常", value: d?.healthy || 0, color: "#29d684" },
    { label: "运行中", value: d?.running || 0, color: "#3785ff" },
    { label: "异常", value: d?.error || 0, color: "#ff5b6f" },
    { label: "未知", value: d?.unknown || 0, color: "#94a6c3" }
  ];
  return (
    <Shell title="总览" subtitle="我的服务现在还活着吗？同步任务进行到哪了？">
      <div className="grid grid-4 mb-20">
        <MetricCard label="服务总数" value={d?.total_services ?? "—"} note={<><span className="t-green">{d?.healthy ?? 0} 正常</span> · <span className="t-blue">{d?.running ?? 0} 运行</span></>} tone="blue" icon="server" />
        <MetricCard label="正常运行" value={d?.healthy ?? "—"} note={<>可用率 <span className="t-green tabnum">{uptime}</span></>} tone="green" icon="checkCircle" series={d?.sys?.cpu?.series?.map((v) => 100 - v)} />
        <MetricCard label="异常服务" value={d?.error ?? "—"} note={<span className="t-red">需要立即处理</span>} tone="red" icon="alert" />
        <MetricCard label="今日告警" value={d?.today_alerts ?? "—"} note={`${d?.alerts?.length || 0} 条触发中`} tone="yellow" icon="alert" />
      </div>

      <div className="cols-12 mb-20">
        <div className="span-4 card card-pad hoverable">
          <div className="card-head"><h3>服务健康分布</h3></div>
          <div className="row gap-24" style={{ justifyContent: "space-between" }}>
            <div className="donut-wrap"><Donut segments={segs} /><div className="donut-center"><div className="num">{d?.total_services || 0}</div><div className="lbl">服务</div></div></div>
            <div className="legend flex-1">{segs.map((s) => <div className="legend-item" key={s.label}><span className="ld" style={{ background: s.color }} /><span className="lname">{s.label}</span><span className="lval">{s.value}</span></div>)}</div>
          </div>
        </div>
        <div className="span-5 card card-pad hoverable">
          <div className="card-head"><h3>最近告警</h3><span className="spacer" /><Link href="/alerts" className="btn btn-ghost btn-sm">全部 <ArrowRight size={14} /></Link></div>
          {d?.alerts?.length ? d.alerts.map((a) => (
            <Link key={a.id} href="/alerts" className="card card-error hoverable card-pad route-card mb-16">
              <div className="row gap-12"><span className={`sev sev-${a.severity}`}>{a.severity}</span><div className="flex-1"><div style={{ fontWeight: 600 }}>{a.title}</div><div className="text-muted" style={{ fontSize: 12.5 }}>{a.service_key} · {fmtRelative(a.triggered_at)}</div></div></div>
            </Link>
          )) : <div className="empty"><h4>暂无触发中的告警</h4><p>所有服务运行正常</p></div>}
        </div>
        <div className="span-3 card card-pad hoverable">
          <div className="card-head"><h3>系统资源</h3></div>
          {(["cpu", "mem", "disk"] as const).map((k) => <div className="row gap-16" style={{ marginBottom: 16 }} key={k}><div className="text-muted" style={{ width: 60 }}>{k.toUpperCase()}</div><div className="flex-1"><Progress value={d?.sys?.[k]?.value || 0} tone={k === "mem" ? "purple" : k === "disk" ? "cyan" : "blue"} /></div><div className="tabnum" style={{ width: 54, textAlign: "right", fontWeight: 700 }}>{d?.sys?.[k]?.value || 0}%</div></div>)}
          <hr className="divider" />
          <div className="row" style={{ justifyContent: "space-between" }}><div className="kv"><span className="k">网络吞吐</span><span className="v t-cyan">{d?.sys?.net?.value || 0} MB/s</span></div><Sparkline series={d?.sys?.net?.series} color="#17d5eb" width={90} height={38} /></div>
        </div>
      </div>

      <div className="cols-12">
        <div className="span-8 card card-pad hoverable">
          <div className="card-head"><h3>服务列表</h3><span className="sub">异常优先置顶</span><span className="spacer" /><Link href="/services" className="btn btn-ghost btn-sm">管理服务 <ArrowRight size={14} /></Link></div>
          <div className="table-wrap"><table className="tbl"><thead><tr><th>服务</th><th>类型</th><th>状态</th><th>进度</th><th>最近心跳</th></tr></thead><tbody>
            {d?.services?.map((s) => <tr key={s.service_key} className={s.status === "error" ? "row-error" : ""}><td><ServiceCell href={`/services/${s.service_key}`} name={s.name} sub={s.service_key} type={s.type} /></td><td><TypeTag type={s.type} /></td><td><Badge status={s.status} /></td><td>{s.progress != null ? <div className="progress-row"><Progress value={s.progress} tone={statusTone(s.status)} /><span className={`pct t-${statusTone(s.status)}`}>{s.progress}%</span></div> : <span className="text-dim">—</span>}</td><td className="text-muted nowrap">{fmtRelative(s.last_heartbeat_at)}</td></tr>)}
          </tbody></table></div>
        </div>
        <div className="span-4">
          <div className="card card-pad hoverable mb-20"><div className="card-head"><h3>任务进度</h3><span className="spacer" /><Link href="/sync" className="btn btn-ghost btn-sm"><ArrowRight size={14} /></Link></div>
            {d?.sync_tasks?.slice(0, 5).map((t) => <Link key={t.task_id} href={`/sync/${t.task_id}`} className="route-card mb-16"><div className="row"><span style={{ fontWeight: 600 }}>{t.name}</span><span className="spacer" /><Badge status={t.status} /></div><div className="progress-row mt-8"><Progress value={t.progress} tone={t.status === "error" ? "red" : "blue"} /><span className="pct t-blue">{Math.round(t.progress || 0)}%</span></div><div className="text-muted" style={{ fontSize: 12 }}>{fmtCompact(t.processed)} / {fmtCompact(t.total)}</div></Link>)}
            {d?.sync_tasks?.length ? null : <div className="empty"><p>暂无同步任务</p></div>}
          </div>
          <div className="card card-pad hoverable"><div className="card-head"><h3>快捷操作</h3></div><div className="grid grid-2 gap-12"><Link href="/settings" className="btn btn-ghost">新增服务</Link><Link href="/api-docs" className="btn btn-ghost">接入文档</Link><Link href="/logs" className="btn btn-ghost">查看日志</Link><Link href="/alerts" className="btn btn-ghost">告警中心</Link></div><hr className="divider" /><div className="stat-grid"><div className="stat-box"><div className="k">今日完成任务</div><div className="v t-purple">{d?.today_completed_tasks || 0}</div></div><div className="stat-box"><div className="k">累计同步</div><div className="v t-cyan">{fmtBytes(d?.total_synced_bytes)}</div></div></div></div>
        </div>
      </div>
    </Shell>
  );
}
