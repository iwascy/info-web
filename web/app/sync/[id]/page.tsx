"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { Shell } from "@/components/Shell";
import { Badge, EmptyState, JsonBlock, MetricCard, PageLoading, PageStack, Progress, Speed } from "@/components/UI";
import { DualLine, LineChart } from "@/components/Charts";
import { fetcher } from "@/lib/api";
import { fmtBytes, fmtCompact, fmtRelative, fmtTime } from "@/lib/format";
import type { SyncTask, TransferAggregate, TransferChannel } from "@/lib/types";

export default function SyncDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: t, isLoading } = useSWR<SyncTask>(`/api/sync-tasks/${id}`, fetcher);
  const stage = t?.current_stage || t?.stage || "—";
  const transfer = t?.transfer_summary;
  const hasTransfer = Boolean(t?.transfer_categories?.length && transfer);
  const byteProgress = t?.total_bytes ? ((t?.done_bytes || 0) / t.total_bytes) * 100 : null;
  const downloadSeries = transfer?.download_series || t?.download_series;
  const uploadSeries = transfer?.upload_series || t?.upload_series;
  const hasDualSeries = Boolean(downloadSeries?.length || uploadSeries?.length);
  const hasRetry = t?.attempt != null || t?.max_attempts != null || t?.retry_count != null || t?.dead_letter != null;
  const retryValue = t?.max_attempts != null ? `${t?.attempt || 0}/${t.max_attempts}` : t?.retry_count != null ? t.retry_count : "—";

  if (isLoading) {
    return (
      <Shell title="同步详情" subtitle="正在读取任务状态">
        <PageLoading label="正在加载同步详情" />
      </Shell>
    );
  }

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
          {!hasTransfer ? (
            <div className="progress-row mt-20">
              <Progress value={t?.progress} large tone={t?.status === "error" ? "red" : "blue"} />
              <span className="pct">{Math.round(t?.progress || 0)}%</span>
            </div>
          ) : null}
        </div>

        {hasTransfer && transfer ? (
          <>
            <div className="cols-12">
              <TransferAggregatePanel label="总下载" aggregate={transfer.download} direction="download" />
              <TransferAggregatePanel label="总上传" aggregate={transfer.upload} direction="upload" />
            </div>
            <div className="card card-pad">
              <div className="card-head">
                <h3>分类传输进度</h3>
                <span className="sub">{transfer.category_count} 个分类 · 下载与上传独立统计</span>
              </div>
              <div className="transfer-category-list">
                {t?.transfer_categories?.map((category) => (
                  <div className="transfer-category-row" key={category.key}>
                    <div className="transfer-category-name">
                      <strong>{category.name}</strong>
                      <span className="cell-key">{category.key}</span>
                    </div>
                    <TransferChannelView label="下载" channel={category.download} direction="download" />
                    <TransferChannelView label="上传" channel={category.upload} direction="upload" />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-4">
            <MetricCard label="总量" value={fmtCompact(t?.total)} tone="blue" />
            <MetricCard label="已处理" value={fmtCompact(t?.processed)} tone="cyan" />
            <MetricCard label="成功" value={fmtCompact(t?.success)} tone="green" />
            <MetricCard label="失败" value={fmtCompact(t?.failed)} tone="red" />
          </div>
        )}

        {!hasTransfer && (t?.current_file || t?.download_speed || t?.upload_speed || stage !== "—") && (
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

        {!hasTransfer && (t?.total_bytes != null || hasRetry) && (
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

        {!hasTransfer ? <div className="card card-pad">
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
        </div> : null}

        <div className="cols-12">
          <div className="span-7 card card-pad">
            <div className="card-head">
              <h3>吞吐趋势</h3>
              <span className="sub">下载 / 上传</span>
            </div>
            {hasDualSeries && uploadSeries?.length ? (
              <DualLine a={downloadSeries} b={uploadSeries} />
            ) : downloadSeries?.length ? (
              <LineChart series={downloadSeries} />
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

function TransferAggregatePanel({ label, aggregate, direction }: { label: string; aggregate: TransferAggregate; direction: "download" | "upload" }) {
  const tone = direction === "download" ? "blue" : "green";
  const countLabel = aggregate.total_items > 0 ? `${fmtCompact(aggregate.done_items)} / ${fmtCompact(aggregate.total_items)} 项` : "未提供项目总数";
  const byteLabel = aggregate.total_bytes > 0 ? `${fmtBytes(aggregate.done_bytes)} / ${fmtBytes(aggregate.total_bytes)}` : "未提供字节总量";
  const basisLabel = aggregate.progress_basis === "bytes" ? "按字节汇总" : aggregate.progress_basis === "items" ? "按项目数汇总" : "按上报百分比汇总";
  return (
    <div className="span-6 card card-pad transfer-overview">
      <div className="card-head">
        <h3>{label}</h3>
        <Badge status={aggregate.status} />
      </div>
      <div className="transfer-overview-speed"><Speed value={aggregate.speed_bps} arrow={direction === "upload" ? "up" : "down"} /></div>
      <div className="progress-row mt-12">
        <Progress value={aggregate.progress} large tone={tone} />
        <span className="pct">{formatProgress(aggregate.progress)}</span>
      </div>
      <div className="transfer-overview-meta">
        <span>{byteLabel}</span>
        <span>{countLabel}</span>
        <span>{basisLabel}</span>
        {aggregate.excluded_channels ? <span>{aggregate.excluded_channels} 类未计入汇总</span> : null}
        {aggregate.indeterminate_channels ? <span>{aggregate.indeterminate_channels} 类进度未知</span> : null}
      </div>
    </div>
  );
}

function TransferChannelView({ label, channel, direction }: { label: string; channel?: TransferChannel; direction: "download" | "upload" }) {
  if (!channel) {
    return <div className="transfer-channel transfer-channel-empty"><span>{label}</span><span>未启用</span></div>;
  }
  const tone = direction === "download" ? "blue" : "green";
  const itemProgress = channel.total_items != null ? `${fmtCompact(channel.done_items)} / ${fmtCompact(channel.total_items)} 项` : null;
  const byteProgress = channel.total_bytes != null ? `${fmtBytes(channel.done_bytes)} / ${fmtBytes(channel.total_bytes)}` : null;
  return (
    <div className="transfer-channel">
      <div className="transfer-channel-head">
        <span className={`transfer-direction t-${tone}`}>{label}</span>
        <Speed value={channel.speed_bps} arrow={direction === "upload" ? "up" : "down"} />
        <Badge status={channel.status} />
      </div>
      <div className="progress-row mt-8">
        <Progress value={channel.progress} tone={tone} />
        <span className="pct">{formatProgress(channel.progress)}</span>
      </div>
      <div className="transfer-channel-meta">
        <span>{byteProgress || itemProgress || "总量未知"}</span>
        {byteProgress && itemProgress ? <span>{itemProgress}</span> : null}
      </div>
      {channel.current_item || channel.message ? <div className="text-muted text-caption mt-8 truncate-1">{channel.current_item || channel.message}</div> : null}
    </div>
  );
}

function formatProgress(value?: number | null) {
  return value == null ? "—" : `${Math.round(value)}%`;
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
