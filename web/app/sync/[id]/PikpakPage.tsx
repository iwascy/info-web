"use client";

import useSWR from "swr";
import { Pause, Play, RefreshCw } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Badge, MetricCard, Progress, Speed, pickIcon } from "@/components/UI";
import { DualLine } from "@/components/Charts";
import { apiPost, fetcher } from "@/lib/api";
import { fmtBytes, fmtNumber, fmtRelative } from "@/lib/format";
import type { AccountHealth, SyncTask } from "@/lib/types";

export default function PikpakPage() {
  const { data: t, mutate } = useSWR<SyncTask>("/api/sync-tasks/pikpak_115_main", fetcher, { refreshInterval: 10000 });
  const total = t?.total || 1;
  const success = t?.success || 0;
  const instant = t?.instant_files || 0;
  const uploaded = t?.uploaded_files || 0;
  const filePct = success / total * 100;
  const bytePct = (t?.done_bytes || 0) / Math.max(1, t?.total_bytes || 1) * 100;
  const instantPct = instant / Math.max(1, success) * 100;
  const running = t?.status === "running";
  const accounts = t?.accounts || [];
  async function pauseResume() {
    await apiPost(`/api/sync-tasks/pikpak_115_main/${running ? "pause" : "resume"}`);
    mutate();
  }
  return (
    <Shell title="PikPak → 115 迁移" subtitle="新加坡二号机 · 网盘文件迁移进度">
      <div className={`card card-pad mb-20 ${t?.status === "paused" ? "card-error" : ""}`}><div className="row wrap" style={{ gap: 16 }}><span className="cell-ico ic-blue" style={{ width: 48, height: 48 }}>{pickIcon("sync", 24)}</span><div style={{ minWidth: 240 }}><div className="row gap-12"><h2>{t?.name || "PikPak → 115 网盘迁移"}</h2><Badge status={t?.status || "unknown"} /></div><div className="text-muted mono" style={{ fontSize: 12.5 }}>{t?.service_key || "pikpak-115-sg2"} · 新加坡二号机 · sg2-node</div></div><span className="spacer" /><div className="row gap-8"><button className={running ? "btn btn-ghost" : "btn btn-primary"} onClick={pauseResume}>{running ? <Pause size={16} /> : <Play size={16} />} {running ? "暂停" : "恢复"}</button><button className="btn btn-ghost btn-icon" onClick={() => mutate()}><RefreshCw size={16} /></button></div></div><hr className="divider" /><div className="stat-grid"><div className="stat-box"><div className="k">运行状态</div><div className={`v ${running ? "t-green" : "t-yellow"}`}>{running ? "迁移中" : "已暂停"}</div></div><div className="stat-box"><div className="k">调度时间窗</div><div className="v" style={{ fontSize: 16 }}>{t?.window_start || "02:00"}-{t?.window_end || "08:00"}</div></div><div className="stat-box"><div className="k">断点游标</div><div className="v mono t-cyan" style={{ fontSize: 16 }}>{t?.cursor || "—"}</div></div><div className="stat-box"><div className="k">最近上报</div><div className="v" style={{ fontSize: 16 }}>{fmtRelative(t?.updated_at)}</div></div></div></div>
      <div className="grid grid-4 mb-20"><MetricCard label="总进度（文件）" value={`${filePct.toFixed(1)}%`} note={`${fmtNumber(success)} / ${fmtNumber(total)}`} tone="blue" icon="activity" /><MetricCard label="115 秒传命中" value={fmtNumber(instant)} note={<span className="t-green">命中率 {instantPct.toFixed(1)}%</span>} tone="green" icon="zap" /><MetricCard label="队列积压" value={fmtNumber(t?.queue_size)} note="待迁移文件" tone="cyan" icon="layers" /><MetricCard label="失败" value={fmtNumber(t?.failed)} note={<span className="t-red">需关注</span>} tone="red" icon="alert" /></div>
      <div className="mig-hero mb-20"><div className="card card-pad"><div className="card-head"><h3>迁移进度</h3><span className="sub">字节 + 文件双口径</span></div><div className="dual-cur"><div className="one"><span className="cell-ico ic-blue">{pickIcon("database", 16)}</span><div><div className="text-muted" style={{ fontSize: 12 }}>数据量</div><div className="big">{fmtBytes(t?.done_bytes)} <span className="text-dim" style={{ fontSize: 13, fontWeight: 500 }}>/ {fmtBytes(t?.total_bytes)}</span></div></div></div><div className="one"><span className="cell-ico ic-cyan">{pickIcon("file", 16)}</span><div><div className="text-muted" style={{ fontSize: 12 }}>文件数</div><div className="big">{fmtNumber(success)} <span className="text-dim" style={{ fontSize: 13, fontWeight: 500 }}>/ {fmtNumber(total)}</span></div></div></div></div><div className="row" style={{ justifyContent: "space-between", margin: "18px 0 7px" }}><span className="text-muted">秒传 + 上传分布</span><span className="mono">{bytePct.toFixed(1)}% 数据量</span></div><div className="flow-line"><div className="seg instant" style={{ width: `${instant / total * 100}%` }} /><div className="seg upload" style={{ left: `${instant / total * 100}%`, width: `${uploaded / total * 100}%` }} /></div><div className="legend inline mt-12"><span><i style={{ background: "linear-gradient(90deg,#29d684,#17d5eb)" }} />秒传 {fmtNumber(instant)}</span><span><i style={{ background: "linear-gradient(90deg,#3785ff,#975cff)" }} />实传 {fmtNumber(uploaded)}</span><span><i style={{ background: "rgba(120,150,200,.25)" }} />待迁移 {fmtNumber(t?.queue_size)}</span></div><div className="cur-file"><span className="pulse" /><div className="flex-1" style={{ minWidth: 0 }}><div className="text-muted" style={{ fontSize: 11.5 }}>正在 {t?.current_stage === "upload" ? "上传至 115" : "从 PikPak 下载"}</div><div className="mono" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t?.current_file || "文件名已隐藏"}</div></div></div></div><div className="card card-pad"><div className="card-head"><h3>两端账号</h3></div>{accounts.length ? accounts.map((account) => <Account key={account.side} account={account} />) : <div className="empty"><p>暂无账号健康数据</p></div>}</div></div>
      <div className="card card-pad mb-20"><div className="card-head"><h3>迁移管线</h3><span className="sub">PikPak 拉取 → 115 推送</span></div><div className="stage-flow">{t?.stages?.map((s, i) => <div key={s.key} className={`stage-node ${s.status}`}>{i < (t.stages?.length || 0) - 1 ? <div className={`stage-line ${s.status === "done" ? "filled" : ""}`} /> : null}<div className="dot">{pickIcon(stageIcon(s.key), 20)}</div><div className="s-name">{s.name}</div><div className="s-meta">{s.meta || s.status}</div></div>)}</div></div>
      <div className="card card-pad mb-20"><div className="card-head"><h3>实时吞吐</h3><span className="spacer" /><div className="legend inline"><span><i style={{ background: "#3785ff" }} />下载 <b className="t-blue mono">{fmtBytes(t?.download_speed)}/s</b></span><span><i style={{ background: "#29d684" }} />上传 <b className="t-green mono">{fmtBytes(t?.upload_speed)}/s</b></span></div></div><DualLine a={t?.download_series} b={t?.upload_series} /></div>
      <div className="card card-pad mb-20"><div className="card-head"><h3>最近迁移对象</h3></div><div className="table-wrap"><table className="tbl"><thead><tr><th>对象</th><th>大小</th><th>路径</th><th>下载</th><th>上传</th><th>状态</th><th>耗时</th></tr></thead><tbody>{t?.recent_files?.map((f) => <tr key={f.id} className={f.status === "error" ? "row-error" : ""}><td className="mono">{f.name || "文件名已隐藏"}</td><td>{fmtBytes(f.size)}</td><td><span className={`path-tag ${pathClass(f.path)}`}>{pathLabel(f.path)}</span></td><td><Speed value={f.download_speed} arrow="down" /></td><td><Speed value={f.upload_speed} arrow="up" /></td><td><Badge status={f.status === "error" ? "error" : f.status} /></td><td>{f.duration || "—"}</td></tr>)}</tbody></table></div></div>
      <div className="card card-pad"><div className="card-head"><h3>异常样本</h3></div>{t?.error_samples?.map((e) => <div key={e.id} className="modal-warn"><b>{e.code}</b><br />{e.reason}<pre className="codeblock json-pre mt-12">{JSON.stringify(e.payload, null, 2)}</pre></div>)}</div>
    </Shell>
  );
}

function Account({ account }: { account: AccountHealth }) {
  const tone = account.side === "source" ? "blue" : "green";
  const pct = account.total_bytes > 0 ? account.used_bytes / account.total_bytes * 100 : 0;
  return <div className="acct"><span className={`cell-ico ic-${tone}`}>{pickIcon(account.side === "source" ? "globe" : "database", 18)}</span><div className="flex-1"><div className="row"><b>{account.label}</b><span className="spacer" /><span className={account.ok ? "t-green" : "t-red"}>{account.ok ? "OK" : "异常"}</span></div><div className="text-muted" style={{ fontSize: 12 }}>{account.account} · {account.note || "—"}</div><div className="bar-mini"><i style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: tone === "blue" ? "#3785ff" : "#29d684" }} /></div><div className="text-muted mt-8" style={{ fontSize: 12 }}>{fmtBytes(account.used_bytes)} / {fmtBytes(account.total_bytes)}</div></div></div>;
}

function stageIcon(key: string) {
  return ({ scan: "search", download: "download", upload: "database", verify: "shield", done: "checkCircle" } as Record<string, string>)[key] || "activity";
}

function pathLabel(path: string) {
  return ({ instant: "115 秒传", relay: "API 中转", upload: "下载+上传", download: "下载+上传" } as Record<string, string>)[path] || path;
}

function pathClass(path: string) {
  return path === "instant" ? "path-instant" : path === "relay" ? "path-relay" : "path-download";
}
