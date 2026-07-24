"use client";

import useSWR from "swr";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Badge, EmptyState, JsonBlock, MetricCard, PageStack, Progress, ServiceCell, Speed } from "@/components/UI";
import { fetcher } from "@/lib/api";
import { fmtBytes, fmtCompact, fmtNumber, fmtRelative, fmtTime, STATUS_LABEL } from "@/lib/format";
import type { DCSpeedOverview, EventRecord, Service, SyncTask } from "@/lib/types";

export default function ServiceDetailPage() {
  const { key } = useParams<{ key: string }>();
  const { data, error } = useSWR<{
    service: Service;
    events: EventRecord[];
    sync_tasks: SyncTask[];
    dc_download_stats: DCSpeedOverview | null;
  }>(`/api/services/${key}`, fetcher, {
    refreshInterval: 10000
  });
  if (error) notFound();
  const s = data?.service;

  return (
    <Shell title={s?.name || "服务详情"} subtitle={s ? `${s.service_key} · ${s.type}` : "加载中"}>
      <PageStack>
        {s ? (
          <div className={`card card-pad ${s.status === "error" ? "card-error" : ""}`}>
            <div className="detail-header">
              <ServiceCell name={s.name} sub={s.service_key} type={s.type} />
              <span className="spacer" />
              <Badge status={s.status} />
            </div>
            <hr className="divider" />
            <p className="text-muted text-sm">{s.message || "暂无消息"}</p>
          </div>
        ) : null}

        <div className="grid grid-4">
          <MetricCard
            label="当前状态"
            value={s ? STATUS_LABEL[s.status] || s.status : "—"}
            note={s?.message ? <span className="truncate-1">{s.message}</span> : undefined}
            tone={s?.status === "error" ? "red" : "blue"}
          />
          <MetricCard label="心跳超时" value={`${s?.heartbeat_timeout_sec || 90}s`} tone="cyan" />
          <MetricCard label="最近心跳" value={fmtRelative(s?.last_heartbeat_at)} tone="green" />
          <MetricCard label="关联任务" value={data?.sync_tasks?.length ?? "—"} tone="purple" />
        </div>

        {data?.dc_download_stats ? (
          <div className="card card-pad">
            <div className="card-head">
              <div>
                <h3>Telegram DC 下载速度</h3>
                <span className="sub">
                  最近 {data.dc_download_stats.retention_days} 天 · 至少 {fmtBytes(data.dc_download_stats.min_bytes)} /{" "}
                  {data.dc_download_stats.min_duration_ms / 1000} 秒的成功下载计入速度
                </span>
              </div>
              <span className="spacer" />
              <span className="sub">上报于 {fmtRelative(data.dc_download_stats.reported_at)}</span>
            </div>
            {data.dc_download_stats.dcs.length ? (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>数据中心</th>
                      <th className="num">平均速度</th>
                      <th className="num">中位速度</th>
                      <th className="num">最近速度</th>
                      <th className="num">峰值速度</th>
                      <th className="num">有效 / 排除 / 失败</th>
                      <th className="num">有效流量</th>
                      <th>最近样本</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dc_download_stats.dcs.map((dc) => (
                      <tr key={dc.dc_id}>
                        <td><strong>DC{dc.dc_id}</strong></td>
                        <td className="num"><Speed value={dc.average_speed} arrow="down" /></td>
                        <td className="num"><Speed value={dc.median_speed} arrow="down" /></td>
                        <td className="num"><Speed value={dc.last_speed} arrow="down" /></td>
                        <td className="num"><Speed value={dc.peak_speed} arrow="down" /></td>
                        <td className="num mono">
                          {fmtNumber(dc.sample_count)} / {fmtNumber(dc.excluded_count)} / {fmtNumber(dc.failure_count)}
                        </td>
                        <td className="num nowrap">{fmtBytes(dc.total_bytes)}</td>
                        <td className="text-muted nowrap">{fmtRelative(dc.last_updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState description="尚未采集到 DC 下载样本" />
            )}
          </div>
        ) : null}

        <div className="cols-12">
          <div className="span-5 card card-pad">
            <div className="card-head">
              <h3>关联任务</h3>
            </div>
            {data?.sync_tasks?.length ? (
              data.sync_tasks.map((t) => (
                <Link key={t.task_id} href={`/sync/${t.task_id}`} className="task-row">
                  <div className="row">
                    <span className="font-semibold truncate-1">{t.name}</span>
                    <span className="spacer" />
                    <Badge status={t.status} />
                  </div>
                  <div className="progress-row mt-8">
                    <Progress value={t.progress} tone={t.status === "error" ? "red" : "blue"} />
                    <span className="pct">{Math.round(t.progress || 0)}%</span>
                  </div>
                  <div className="stat-grid mt-12">
                    <div className="stat-box">
                      <div className="k">阶段</div>
                      <div className="v v-sm">{stageLabel(t.current_stage || t.stage)}</div>
                    </div>
                    <div className="stat-box">
                      <div className="k">处理</div>
                      <div className="v v-sm">
                        {fmtCompact(t.processed)} / {fmtCompact(t.total)}
                      </div>
                    </div>
                    <div className="stat-box">
                      <div className="k">失败</div>
                      <div className="v v-sm t-red">{fmtCompact(t.failed)}</div>
                    </div>
                    <div className="stat-box">
                      <div className="k">速度</div>
                      <div className="v v-sm">
                        <Speed value={t.download_speed || t.upload_speed} arrow={t.upload_speed ? "up" : "down"} />
                      </div>
                    </div>
                  </div>
                  {t.current_file ? <div className="text-muted text-caption mt-8 truncate-inline">{t.current_file}</div> : null}
                  {t.last_error ? <div className="modal-warn mt-12">{t.last_error}</div> : null}
                </Link>
              ))
            ) : (
              <EmptyState description="暂无任务" />
            )}
          </div>

          <div className="span-7 card card-pad">
            <div className="card-head">
              <h3>事件历史</h3>
              <span className="sub">JSON 原文保留</span>
            </div>
            {data?.events?.length ? (
              <div className="timeline">
                {data.events.map((e) => (
                  <div key={e.id} className={`tl-item ${e.level === "error" ? "error" : e.level === "success" ? "success" : "running"}`}>
                    <span className="tl-dot" />
                    <div className="tl-head">
                      <span className="tl-msg">{e.message || e.type}</span>
                      <span className="tl-time">{fmtTime(e.created_at)}</span>
                    </div>
                    <div className="tl-meta">
                      {e.service_key} · {e.type} · {fmtRelative(e.created_at)}
                    </div>
                    <div className="mt-12">
                      <JsonBlock value={e.raw_payload} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState description="暂无事件" />
            )}
          </div>
        </div>
      </PageStack>
    </Shell>
  );
}

function stageLabel(stage?: string | null) {
  return (
    (
      {
        scan: "扫描",
        download: "下载",
        upload: "上传",
        verify: "校验",
        cleaning: "清洗",
        writing: "写入",
        queue: "排队",
        retry_waiting: "等待重试",
        failed: "失败",
        done: "完成",
        forward: "转发",
        sync: "同步"
      } as Record<string, string>
    )[stage || ""] ||
    stage ||
    "—"
  );
}
