"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Badge, EmptyState, MetricCard, PageStack, Progress, ServiceCell, TypeTag } from "@/components/UI";
import { Donut, Sparkline } from "@/components/Charts";
import { fetcher } from "@/lib/api";
import { fmtBytes, fmtCompact, fmtRelative, statusTone } from "@/lib/format";
import type { Dashboard } from "@/lib/types";

/** 总览页「最近告警」最多展示条数，避免列表过长撑高整页 */
const RECENT_ALERTS_LIMIT = 5;

export default function DashboardPage() {
  const { data } = useSWR<Dashboard>("/api/dashboard", fetcher, { refreshInterval: 10000 });
  const d = data;
  const uptime = d?.uptime_pct == null ? "—" : `${d.uptime_pct}%`;
  const traffic = d?.server_traffic || [];
  const hasTraffic = traffic.length > 0 || (d?.server_traffic_quota ?? 0) > 0;
  const trafficPct = d?.server_traffic_quota ? ((d.server_traffic_bytes || 0) / d.server_traffic_quota) * 100 : 0;
  const trafficTone = usageTone(trafficPct);
  const segs = [
    { label: "正常", value: d?.healthy || 0, color: "#29d684" },
    { label: "运行中", value: d?.running || 0, color: "#3785ff" },
    { label: "异常", value: d?.error || 0, color: "#ff5b6f" },
    { label: "未知", value: d?.unknown || 0, color: "#94a6c3" }
  ];
  const serviceSeries = d?.services?.map((_, i) => i + 1);
  const healthySeries = d?.services?.map((_, i, xs) => xs.slice(0, i + 1).filter((s) => s.status === "healthy").length);
  const errorSeries = d?.services?.map((_, i, xs) => xs.slice(0, i + 1).filter((s) => s.status === "error").length);
  const alertSeries = d?.alerts?.map((_, i) => i + 1);

  return (
    <Shell title="总览" subtitle="我的服务现在还活着吗？同步任务进行到哪了？">
      <PageStack>
        <div className="grid grid-4">
          <MetricCard
            label="服务总数"
            value={d?.total_services ?? "—"}
            note={
              <>
                <span className="t-green">{d?.healthy ?? 0} 正常</span> · <span className="t-blue">{d?.running ?? 0} 运行</span>
              </>
            }
            tone="blue"
            icon="server"
            series={serviceSeries}
          />
          <MetricCard
            label="正常运行"
            value={d?.healthy ?? "—"}
            note={
              <>
                可用率 <span className="t-green tabnum">{uptime}</span>
              </>
            }
            tone="green"
            icon="checkCircle"
            series={healthySeries}
          />
          <MetricCard label="异常服务" value={d?.error ?? "—"} note={<span className="t-red">需要立即处理</span>} tone="red" icon="alert" series={errorSeries} />
          <MetricCard label="今日告警" value={d?.today_alerts ?? "—"} note={`${d?.alerts?.length || 0} 条触发中`} tone="yellow" icon="alert" series={alertSeries} />
        </div>

        {hasTraffic ? (
          <div className="cols-12">
            <div className="span-8 card card-pad hoverable">
              <div className="card-head">
                <h3>月度服务器流量</h3>
                <span className="sub">按公网接口统计</span>
                <span className="spacer" />
                <span className={`tabnum t-${trafficTone}`}>{trafficPct.toFixed(2)}%</span>
              </div>
              <div className="progress-row mb-16">
                <Progress value={trafficPct} large tone={trafficTone} />
                <span className={`pct t-${trafficTone}`}>
                  {fmtBytes(d?.server_traffic_bytes)} / {fmtBytes(d?.server_traffic_quota)}
                </span>
              </div>
              <div className="traffic-list">
                {traffic.map((tr) => (
                  <div className="traffic-row" key={`${tr.server_key}-${tr.interface}-${tr.period}`}>
                    <div className="traffic-main">
                      <div className="min-w-0">
                        <div className="cell-title">{tr.server_name}</div>
                        <div className="cell-key">
                          {tr.server_key} · {tr.interface} · {tr.period}
                        </div>
                      </div>
                      <span className={`traffic-pct t-${usageTone(tr.usage_pct || 0)}`}>{(tr.usage_pct || 0).toFixed(2)}%</span>
                    </div>
                    <div className="progress-row mt-8">
                      <Progress value={tr.usage_pct} tone={usageTone(tr.usage_pct || 0)} />
                      <span className="pct">{fmtBytes(tr.total_bytes)}</span>
                    </div>
                    <div className="traffic-meta">
                      <span>入站 {fmtBytes(tr.rx_bytes)}</span>
                      <span>出站 {fmtBytes(tr.tx_bytes)}</span>
                      <span>采样 {fmtRelative(tr.sampled_at)}</span>
                    </div>
                  </div>
                ))}
                {traffic.length ? null : <EmptyState description="暂无服务器流量上报" />}
              </div>
            </div>
            <div className="span-4 card card-pad hoverable">
              <div className="card-head">
                <h3>流量水位</h3>
                <span className="sub">迁移前先看这里</span>
              </div>
              <div className="stat-grid">
                <div className="stat-box">
                  <div className="k">已用</div>
                  <div className={`v t-${trafficTone}`}>{fmtBytes(d?.server_traffic_bytes)}</div>
                </div>
                <div className="stat-box">
                  <div className="k">剩余</div>
                  <div className="v t-green">{fmtBytes(Math.max(0, (d?.server_traffic_quota || 0) - (d?.server_traffic_bytes || 0)))}</div>
                </div>
                <div className="stat-box">
                  <div className="k">服务器</div>
                  <div className="v">{traffic.length}</div>
                </div>
                <div className="stat-box">
                  <div className="k">最高水位</div>
                  <div className={`v t-${usageTone(Math.max(0, ...traffic.map((x) => x.usage_pct || 0)))}`}>
                    {Math.max(0, ...traffic.map((x) => x.usage_pct || 0)).toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="cols-12">
          <div className="span-4 card card-pad hoverable">
            <div className="card-head">
              <h3>服务健康分布</h3>
            </div>
            <div className="row gap-24 justify-between">
              <div className="donut-wrap">
                <Donut segments={segs} size={160} />
                <div className="donut-center">
                  <div className="num">{d?.total_services || 0}</div>
                  <div className="lbl">服务</div>
                </div>
              </div>
              <div className="legend flex-1">
                {segs.map((s) => (
                  <div className="legend-item" key={s.label}>
                    <span className="ld" style={{ backgroundColor: s.color }} />
                    <span className="lname">{s.label}</span>
                    <span className="lval">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="span-5 card card-pad hoverable">
            <div className="card-head">
              <h3>最近告警</h3>
              <span className="spacer" />
              <Link href="/alerts" className="btn btn-ghost btn-sm">
                全部 <ArrowRight size={14} />
              </Link>
            </div>
            <div className="alert-list">
              {d?.alerts?.length ? (
                <>
                  {d.alerts.slice(0, RECENT_ALERTS_LIMIT).map((a) => (
                    <Link key={a.id} href="/alerts" className="alert-item">
                      <div className="row gap-12">
                        <span className={`sev sev-${a.severity}`}>{a.severity}</span>
                        <div className="flex-1">
                          <div className="alert-item-title">{a.title}</div>
                          <div className="alert-item-meta">
                            {a.service_key} · {fmtRelative(a.triggered_at)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {d.alerts.length > RECENT_ALERTS_LIMIT ? (
                    <Link href="/alerts" className="alert-list-more">
                      还有 {d.alerts.length - RECENT_ALERTS_LIMIT} 条 · 查看全部
                    </Link>
                  ) : null}
                </>
              ) : (
                <EmptyState title="暂无触发中的告警" description="所有服务运行正常" />
              )}
            </div>
          </div>

          <div className="span-3 card card-pad hoverable">
            <div className="card-head">
              <h3>系统资源</h3>
            </div>
            {(["cpu", "mem", "disk"] as const).map((k) => (
              <div className="resource-row" key={k}>
                <div className="resource-label">{k.toUpperCase()}</div>
                <div className="flex-1">
                  <Progress value={d?.sys?.[k]?.value || 0} tone={k === "mem" ? "purple" : k === "disk" ? "cyan" : "blue"} />
                </div>
                <div className="resource-pct">{d?.sys?.[k]?.value || 0}%</div>
              </div>
            ))}
            <hr className="divider" />
            <div className="row-between">
              <div className="kv">
                <span className="k">网络吞吐</span>
                <span className="v t-cyan">{d?.sys?.net?.value || 0} MB/s</span>
              </div>
              <Sparkline series={d?.sys?.net?.series} color="#17d5eb" width={90} height={36} />
            </div>
          </div>
        </div>

        <div className="cols-12">
          <div className="span-8 card card-pad hoverable">
            <div className="card-head">
              <h3>服务列表</h3>
              <span className="sub">异常优先置顶</span>
              <span className="spacer" />
              <Link href="/services" className="btn btn-ghost btn-sm">
                管理服务 <ArrowRight size={14} />
              </Link>
            </div>
            {d?.services?.length ? (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>服务</th>
                      <th>类型</th>
                      <th>状态</th>
                      <th className="num">进度</th>
                      <th>最近心跳</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.services.map((s) => (
                      <tr key={s.service_key} className={s.status === "error" ? "row-error" : ""}>
                        <td>
                          <ServiceCell href={`/services/${s.service_key}`} name={s.name} sub={s.service_key} type={s.type} />
                        </td>
                        <td>
                          <TypeTag type={s.type} />
                        </td>
                        <td>
                          <Badge status={s.status} />
                        </td>
                        <td className="num">
                          {s.progress != null ? (
                            <div className="progress-row">
                              <Progress value={s.progress} tone={statusTone(s.status)} />
                              <span className={`pct t-${statusTone(s.status)}`}>{s.progress}%</span>
                            </div>
                          ) : (
                            <span className="text-dim">—</span>
                          )}
                        </td>
                        <td className="text-muted nowrap">{fmtRelative(s.last_heartbeat_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="暂无服务" description="接入真实服务后会显示在这里" />
            )}
          </div>

          <div className="span-4 section-stack">
            <div className="card card-pad hoverable">
              <div className="card-head">
                <h3>任务进度</h3>
                <span className="spacer" />
                <Link href="/sync" className="btn btn-ghost btn-sm" aria-label="查看同步任务">
                  <ArrowRight size={14} />
                </Link>
              </div>
              {d?.sync_tasks?.length ? (
                d.sync_tasks.slice(0, 5).map((t) => (
                  <Link key={t.task_id} href={`/sync/${t.task_id}`} className="task-row">
                    <div className="row">
                      <span className="font-semibold truncate-1">{t.name}</span>
                      <span className="spacer" />
                      <Badge status={t.status} />
                    </div>
                    <div className="progress-row mt-8">
                      <Progress value={t.progress} tone={t.status === "error" ? "red" : "blue"} />
                      <span className="pct t-blue">{Math.round(t.progress || 0)}%</span>
                    </div>
                    <div className="text-caption text-muted mt-8">
                      {fmtCompact(t.processed)} / {fmtCompact(t.total)}
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState description="暂无同步任务" />
              )}
            </div>

            <div className="card card-pad hoverable">
              <div className="card-head">
                <h3>快捷操作</h3>
              </div>
              <div className="grid grid-2 gap-12">
                <Link href="/settings" className="btn btn-ghost">
                  新增服务
                </Link>
                <Link href="/api-docs" className="btn btn-ghost">
                  接入文档
                </Link>
                <Link href="/logs" className="btn btn-ghost">
                  查看日志
                </Link>
                <Link href="/alerts" className="btn btn-ghost">
                  告警中心
                </Link>
              </div>
              <hr className="divider" />
              <div className="stat-grid">
                <div className="stat-box">
                  <div className="k">今日完成任务</div>
                  <div className="v t-purple">{d?.today_completed_tasks || 0}</div>
                </div>
                <div className="stat-box">
                  <div className="k">累计同步</div>
                  <div className="v t-cyan">{fmtBytes(d?.total_synced_bytes)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageStack>
    </Shell>
  );
}

function usageTone(pct: number) {
  if (pct >= 90) return "red";
  if (pct >= 80) return "yellow";
  return "cyan";
}
