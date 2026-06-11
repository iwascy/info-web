"use client";

import useSWR from "swr";
import { Pause, Play, RefreshCw } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Badge, MetricCard, Progress, Speed, pickIcon } from "@/components/UI";
import { DualLine } from "@/components/Charts";
import { apiPost, fetcher } from "@/lib/api";
import { fmtBytes, fmtCompact, fmtNumber, fmtRelative } from "@/lib/format";
import type { AccountHealth, SyncTask } from "@/lib/types";

const TASK_ID = "pikpak-to-115-migration";

export default function Pikpak115Page() {
  const { data: t, error, mutate } = useSWR<SyncTask>(`/api/sync-tasks/${TASK_ID}`, fetcher, { refreshInterval: 10000, shouldRetryOnError: false });
  const running = t?.status === "running";
  const total = t?.total || 0;
  const success = t?.success || 0;
  const failed = t?.failed || 0;
  const queue = t?.queue_size ?? Math.max(total - success, 0);
  const filePct = total > 0 ? success / total * 100 : t?.progress || 0;
  const bytePct = t?.total_bytes ? (t?.done_bytes || 0) / t.total_bytes * 100 : null;
  const accounts = t?.accounts || [];

  async function pauseResume() {
    if (!t) return;
    await apiPost(`/api/sync-tasks/${TASK_ID}/${running ? "pause" : "resume"}`);
    mutate();
  }

  return (
    <Shell title="PikPak to 115 Migration" subtitle={t ? `${t.service_key} · ${t.task_id}` : "等待迁移项目上报真实数据"}>
      {error ? <div className="card card-pad mb-20"><div className="empty"><h4>暂无迁移数据</h4><p>迁移项目上报 task_id=pikpak-to-115-migration 后会显示在这里</p></div></div> : null}
      <div className={`card card-pad mb-20 ${t?.status === "paused" || t?.status === "error" ? "card-error" : ""}`}>
        <div className="row wrap" style={{ gap: 16 }}>
          <span className="cell-ico ic-blue" style={{ width: 48, height: 48 }}>{pickIcon("sync", 24)}</span>
          <div style={{ minWidth: 240 }}>
            <div className="row gap-12"><h2>{t?.name || "PikPak to 115 Migration"}</h2><Badge status={t?.status || "unknown"} /></div>
            <div className="text-muted mono" style={{ fontSize: 12.5 }}>{t?.service_key || "pikpak-to-115"} · {TASK_ID}</div>
          </div>
          <span className="spacer" />
          <div className="row gap-8">
            <button className={running ? "btn btn-ghost" : "btn btn-primary"} onClick={pauseResume} disabled={!t}>{running ? <Pause size={16} /> : <Play size={16} />} {running ? "暂停" : "恢复"}</button>
            <button className="btn btn-ghost btn-icon" onClick={() => mutate()}><RefreshCw size={16} /></button>
          </div>
        </div>
        <hr className="divider" />
        <div className="stat-grid">
          <div className="stat-box"><div className="k">运行状态</div><div className={`v ${running ? "t-green" : "t-yellow"}`}>{t?.status || "未知"}</div></div>
          <div className="stat-box"><div className="k">断点游标</div><div className="v mono t-cyan" style={{ fontSize: 16 }}>{t?.cursor || "—"}</div></div>
          <div className="stat-box"><div className="k">限额恢复</div><div className="v" style={{ fontSize: 16 }}>{t?.window_end || "—"}</div></div>
          <div className="stat-box"><div className="k">最近上报</div><div className="v" style={{ fontSize: 16 }}>{fmtRelative(t?.updated_at)}</div></div>
        </div>
      </div>

      <div className="grid grid-4 mb-20">
        <MetricCard label="文件进度" value={`${filePct.toFixed(1)}%`} note={`${fmtNumber(success)} / ${fmtNumber(total)}`} tone="blue" icon="activity" />
        <MetricCard label="队列积压" value={fmtNumber(queue)} note="待迁移文件" tone="cyan" icon="layers" />
        <MetricCard label="失败" value={fmtNumber(failed)} note={failed ? <span className="t-red">需处理</span> : "暂无失败"} tone="red" icon="alert" />
        <MetricCard label="已跳过" value={fmtNumber(t?.skipped)} tone="purple" icon="shield" />
      </div>

      <div className="mig-hero mb-20">
        <div className="card card-pad">
          <div className="card-head"><h3>迁移进度</h3><span className="sub">来自迁移 worker 上报</span></div>
          <div className="dual-cur">
            <div className="one"><span className="cell-ico ic-blue">{pickIcon("database", 16)}</span><div><div className="text-muted" style={{ fontSize: 12 }}>数据量</div><div className="big">{fmtBytes(t?.done_bytes)} <span className="text-dim" style={{ fontSize: 13, fontWeight: 500 }}>/ {fmtBytes(t?.total_bytes)}</span></div></div></div>
            <div className="one"><span className="cell-ico ic-cyan">{pickIcon("file", 16)}</span><div><div className="text-muted" style={{ fontSize: 12 }}>文件数</div><div className="big">{fmtCompact(success)} <span className="text-dim" style={{ fontSize: 13, fontWeight: 500 }}>/ {fmtCompact(total)}</span></div></div></div>
          </div>
          <div className="row" style={{ justifyContent: "space-between", margin: "18px 0 7px" }}><span className="text-muted">整体进度</span><span className="mono">{bytePct == null ? `${filePct.toFixed(1)}% 文件` : `${bytePct.toFixed(1)}% 数据量`}</span></div>
          <Progress value={bytePct ?? filePct} large tone={t?.status === "error" ? "red" : "blue"} />
          <div className="cur-file"><span className="pulse" /><div className="flex-1" style={{ minWidth: 0 }}><div className="text-muted" style={{ fontSize: 11.5 }}>当前阶段：{t?.current_stage || t?.stage || "—"}</div><div className="mono" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t?.current_file || "文件名已隐藏"}</div></div></div>
        </div>
        <div className="card card-pad"><div className="card-head"><h3>账号 / 端点</h3></div>{accounts.length ? accounts.map((account) => <Account key={`${account.side}-${account.label}`} account={account} />) : <div className="empty"><p>暂无账号健康数据</p></div>}</div>
      </div>

      <div className="card card-pad mb-20"><div className="card-head"><h3>迁移管线</h3><span className="sub">{"PikPak 拉取 -> 115 推送"}</span></div><div className="stage-flow">{t?.stages?.map((s, i) => <div key={s.key} className={`stage-node ${s.status}`}>{i < (t.stages?.length || 0) - 1 ? <div className={`stage-line ${s.status === "done" ? "filled" : ""}`} /> : null}<div className="dot">{pickIcon(stageIcon(s.key), 20)}</div><div className="s-name">{s.name}</div><div className="s-meta">{s.meta || s.status}</div></div>) || <div className="empty"><p>暂无阶段数据</p></div>}</div></div>
      <div className="card card-pad mb-20"><div className="card-head"><h3>实时吞吐</h3><span className="spacer" /><div className="legend inline"><span><i style={{ background: "#3785ff" }} />下载 <b className="t-blue mono">{fmtBytes(t?.download_speed)}/s</b></span><span><i style={{ background: "#29d684" }} />上传 <b className="t-green mono">{fmtBytes(t?.upload_speed)}/s</b></span></div></div>{t?.download_series?.length || t?.upload_series?.length ? <DualLine a={t?.download_series} b={t?.upload_series} /> : <div className="empty"><p>暂无吞吐上报</p></div>}</div>
      <div className="card card-pad mb-20"><div className="card-head"><h3>最近迁移对象</h3></div>{t?.recent_files?.length ? <div className="table-wrap"><table className="tbl"><thead><tr><th>对象</th><th>大小</th><th>路径</th><th>下载</th><th>上传</th><th>状态</th><th>耗时</th></tr></thead><tbody>{t.recent_files.map((f) => <tr key={f.id} className={f.status === "error" ? "row-error" : ""}><td className="mono">{f.name || "文件名已隐藏"}</td><td>{fmtBytes(f.size)}</td><td><span className={`path-tag ${pathClass(f.path)}`}>{pathLabel(f.path)}</span></td><td><Speed value={f.download_speed} arrow="down" /></td><td><Speed value={f.upload_speed} arrow="up" /></td><td><Badge status={f.status === "error" ? "error" : f.status} /></td><td>{f.duration || "—"}</td></tr>)}</tbody></table></div> : <div className="empty"><p>暂无迁移对象上报</p></div>}</div>
      <div className="card card-pad"><div className="card-head"><h3>异常样本</h3></div>{t?.error_samples?.length ? t.error_samples.map((e) => <div key={e.id} className="modal-warn"><b>{e.code}</b> · {e.file}<br />{e.reason}</div>) : <div className="empty"><p>暂无异常样本</p></div>}</div>
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
