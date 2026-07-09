"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { Shell } from "@/components/Shell";
import { Badge, EmptyState, JsonBlock, MetricCard, PageStack, Progress, Speed } from "@/components/UI";
import { DualLine, LineChart } from "@/components/Charts";
import { fetcher } from "@/lib/api";
import { fmtBytes, fmtCompact, fmtRelative, fmtTime } from "@/lib/format";
import type { SyncTask } from "@/lib/types";

export default function SyncDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: t } = useSWR<SyncTask>(`/api/sync-tasks/${id}`, fetcher, { refreshInterval: 10000 });
  const stage = t?.current_stage || t?.stage || "—";
  const byteProgress = t?.total_bytes ? ((t?.done_bytes || 0) / t.total_bytes) * 100 : null;
  const hasDualSeries = Boolean(t?.download_series?.length || t?.upload_series?.length);
  const hasRetry = t?.attempt != null || t?.max_attempts != null || t?.retry_count != null || t?.dead_letter != null;
  const retryValue = t?.max_attempts != null ? `${t?.attempt || 0}/${t.max_attempts}` : t?.retry_count != null ? t.retry_count : "—";

  return (
    <Shell title={t?.name || "同步详情"} subtitle={t ? `${t.service_key} · ${t.task_id}` : "加载中"}>
      <PageStack>
        <div className={`card card-pad ${t?.status === "error" ? "card-error" : ""}`}>
          <div className="detail-header">
            <div className="min-w-0">
              <h2 className="hero-title">{t?.name || "—"}</h2>
              <div className="cell-key mt-8">{t?.message || t?.last_error || "等待数据"}</div>
            </div>
            <span className="spacer" />
            <Badge status={t?.status || "unknown"} />
          </div>
          <div className="progress-row mt-20">
            <Progress value={t?.progress} large tone={t?.status === "error" ? "red" : "blue"} />
            <span className="pct">{Math.round(t?.progress || 0)}%</span>
          </div>
        </div>

        <div className="grid grid-4">
          <MetricCard label="总量" value={fmtCompact(t?.total)} tone="blue" />
          <MetricCard label="已处理" value={fmtCompact(t?.processed)} tone="cyan" />
          <MetricCard label="成功" value={fmtCompact(t?.success)} tone="green" />
          <MetricCard label="失败" value={fmtCompact(t?.failed)} tone="red" />
        </div>

        {(t?.current_file || t?.download_speed || t?.upload_speed || stage !== "—") && (
          <div className="grid grid-4">
            <MetricCard
              label="当前阶段"
              value={<span className="text-title-sm">{stageLabel(stage)}</span>}
              note={stage !== stageLabel(stage) ? stage : undefined}
              tone={t?.status === "error" ? "red" : "blue"}
            />
            <MetricCard
              label="当前文件"
              value={<span className="truncate-inline text-title-sm">{t?.current_file || "—"}</span>}
              note={t?.cursor ? `游标 ${t.cursor}` : undefined}
              tone="cyan"
              icon="file"
            />
            <MetricCard label="下载速度" value={<Speed value={t?.download_speed} arrow="down" />} tone="blue" icon="download" />
            <MetricCard label="上传速度" value={<Speed value={t?.upload_speed} arrow="up" />} tone="green" icon="upload" />
          </div>
        )}

        {(t?.total_bytes != null || hasRetry) && (
          <div className="cols-12">
            <div className={`card card-pad ${hasRetry ? "span-7" : "span-12"}`}>
              <div className="card-head">
                <h3>文件迁移</h3>
                <span className="sub">
                  {fmtBytes(t?.done_bytes)} / {fmtBytes(t?.total_bytes)}
                </span>
              </div>
              <div className="progress-row mb-16">
                <Progress value={byteProgress} large tone="cyan" />
                <span className="pct">{byteProgress == null ? "—" : `${Math.round(byteProgress)}%`}</span>
              </div>
              <div className="stat-grid">
                <div className="stat-box">
                  <div className="k">已完成字节</div>
                  <div className="v">{fmtBytes(t?.done_bytes)}</div>
                </div>
                <div className="stat-box">
                  <div className="k">总字节</div>
                  <div className="v">{fmtBytes(t?.total_bytes)}</div>
                </div>
                <div className="stat-box">
                  <div className="k">已上传文件</div>
                  <div className="v">{fmtCompact(t?.uploaded_files)}</div>
                </div>
                <div className="stat-box">
                  <div className="k">队列</div>
                  <div className="v">{fmtCompact(t?.queue_size)}</div>
                </div>
              </div>
            </div>
            {hasRetry ? (
              <div className="span-5 card card-pad">
                <div className="card-head">
                  <h3>重试与窗口</h3>
                  <span className="sub">{t?.dead_letter ? "死信" : "运行控制"}</span>
                </div>
                <div className="stat-grid">
                  <div className="stat-box">
                    <div className="k">重试</div>
                    <div className="v">{retryValue}</div>
                  </div>
                  <div className="stat-box">
                    <div className="k">下次重试</div>
                    <div className="v v-sm">{fmtRelative(t?.next_attempt_at)}</div>
                  </div>
                  <div className="stat-box">
                    <div className="k">窗口</div>
                    <div className="v v-sm">{t?.window_enabled ? `${t?.window_start || "—"}-${t?.window_end || "—"}` : "关闭"}</div>
                  </div>
                  <div className="stat-box">
                    <div className="k">死信</div>
                    <div className="v">{t?.dead_letter ? "是" : "否"}</div>
                  </div>
                </div>
                {t?.last_error ? <p className="modal-warn mt-16">{t.last_error}</p> : null}
              </div>
            ) : null}
          </div>
        )}

        <div className="card card-pad">
          <div className="card-head">
            <h3>阶段流</h3>
            <span className="sub">按当前阶段自动点亮</span>
          </div>
          {t?.stages?.length ? (
            <div className="stage-flow">
              {t.stages.map((s, i) => (
                <div key={s.key} className={`stage-node ${s.status}`}>
                  {i < (t.stages?.length || 0) - 1 ? <div className={`stage-line ${s.status === "done" ? "filled" : ""}`} /> : null}
                  <div className="dot">{i + 1}</div>
                  <div className="s-name">{s.name}</div>
                  <div className="s-meta">{s.meta || s.status}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState description="暂无阶段信息" />
          )}
        </div>

        <div className="cols-12">
          <div className="span-7 card card-pad">
            <div className="card-head">
              <h3>吞吐趋势</h3>
              <span className="sub">下载 / 上传</span>
            </div>
            {hasDualSeries && t?.upload_series?.length ? (
              <DualLine a={t?.download_series} b={t?.upload_series} />
            ) : t?.download_series?.length ? (
              <LineChart series={t.download_series} />
            ) : (
              <EmptyState description="暂无吞吐采样" />
            )}
          </div>
          <div className="span-5 card card-pad">
            <div className="card-head">
              <h3>批次记录</h3>
            </div>
            {t?.batches?.length ? (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>批次</th>
                      <th className="num">总量</th>
                      <th className="num">成功</th>
                      <th className="num">失败</th>
                      <th className="num">耗时</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.batches.map((b) => (
                      <tr key={b.id}>
                        <td>{b.range}</td>
                        <td className="num">{fmtCompact(b.total)}</td>
                        <td className="num">{fmtCompact(b.success)}</td>
                        <td className="num t-red">{fmtCompact(b.failed)}</td>
                        <td className="num">{b.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState description="暂无批次记录" />
            )}
          </div>
        </div>

        {(t?.recent_files?.length || t?.error_samples) && (
          <div className="cols-12">
            {t?.recent_files?.length ? (
              <div className="span-7 card card-pad">
                <div className="card-head">
                  <h3>最近文件</h3>
                </div>
                <div className="table-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>文件</th>
                        <th className="num">大小</th>
                        <th>状态</th>
                        <th className="num">下载</th>
                        <th className="num">上传</th>
                        <th>时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.recent_files.map((f) => (
                        <tr key={f.id}>
                          <td className="truncate-cell" title={f.name}>
                            {f.name}
                          </td>
                          <td className="num">{fmtBytes(f.size)}</td>
                          <td>{stageLabel(f.status)}</td>
                          <td className="num">
                            <Speed value={f.download_speed} arrow="down" />
                          </td>
                          <td className="num">
                            <Speed value={f.upload_speed} arrow="up" />
                          </td>
                          <td className="text-muted nowrap">{fmtTime(f.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            <div className={`card card-pad ${t?.recent_files?.length ? "span-5" : "span-12"}`}>
              <div className="card-head">
                <h3>异常样本</h3>
              </div>
              {t?.error_samples?.length ? (
                t.error_samples.map((e) => (
                  <details key={e.id} className="mb-16">
                    <summary className="clickable">
                      <span className={`sev sev-${e.level === "error" ? "high" : "medium"}`}>{e.code}</span> {e.file} · {e.reason}
                    </summary>
                    <div className="mt-12">
                      <JsonBlock value={e.payload} />
                    </div>
                  </details>
                ))
              ) : (
                <EmptyState description="暂无异常样本" />
              )}
              <div className="text-muted text-caption mt-16">最近更新：{fmtRelative(t?.updated_at)}</div>
            </div>
          </div>
        )}

        {!t?.error_samples?.length && !t?.recent_files?.length ? (
          <div className="card card-pad">
            <div className="card-head">
              <h3>异常样本</h3>
            </div>
            <EmptyState description="暂无异常样本" />
            <div className="text-muted text-caption mt-16">最近更新：{fmtRelative(t?.updated_at)}</div>
          </div>
        ) : null}
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
