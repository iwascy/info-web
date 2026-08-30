"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useRefreshNow } from "@/components/AppProviders";
import { Shell } from "@/components/Shell";
import { Badge, Chip, EmptyState, MetricCard, PageLoading, PageStack, Pagination, Toolbar } from "@/components/UI";
import { apiPost, fetcher } from "@/lib/api";
import { filterLabel, fmtRelative } from "@/lib/format";
import type { Alert, PageResponse } from "@/lib/types";

const filters = ["all", "firing", "resolved", "muted", "high", "medium", "low"];
const PAGE_SIZE = 25;

export default function AlertsPage() {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const query = useMemo(
    () => `/api/alerts/page?filter=${encodeURIComponent(filter)}&page=${page}&page_size=${PAGE_SIZE}`,
    [filter, page]
  );
  const { data, isLoading } = useSWR<PageResponse<Alert>>(query, fetcher);
  const refreshNow = useRefreshNow();
  const alerts = data?.items || [];
  const counts = data?.counts || {};

  useEffect(() => setPage(1), [filter]);

  async function act(id: number, action: "resolve" | "mute") {
    await apiPost(`/api/alerts/${id}/${action}`);
    await refreshNow();
  }

  async function resolveAll() {
    if (!confirm("恢复所有触发中的告警？")) return;
    await apiPost("/api/alerts/resolve-all");
    await refreshNow();
  }

  return (
    <Shell title="告警" subtitle="按严重度排序，触发中的告警优先处理。">
      <PageStack>
        <div className="grid grid-4">
          <MetricCard label="触发中" value={counts.firing ?? "—"} tone="red" icon="alert" />
          <MetricCard label="高严重度" value={counts.high ?? "—"} tone="yellow" icon="alert" />
          <MetricCard label="已恢复" value={counts.resolved ?? "—"} tone="green" icon="checkCircle" />
          <MetricCard label="已静默" value={counts.muted ?? "—"} tone="purple" icon="shield" />
        </div>

        <Toolbar
          left={filters.map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)} count={counts[f]}>
              {filterLabel(f)}
            </Chip>
          ))}
          right={
            <button className="btn btn-ghost" onClick={resolveAll} type="button">
              全部恢复
            </button>
          }
        />

        {isLoading && !data ? <PageLoading label="正在加载告警" /> : <div className="section-stack">
          {alerts.map((a) => (
            <div key={a.id} className={`card card-pad hoverable ${a.status === "firing" ? "card-error" : ""}`}>
              <div className="detail-header">
                <span className={`sev sev-${a.severity}`}>{filterLabel(a.severity)}</span>
                <div className="flex-1">
                  <div className="text-title-sm">{a.title}</div>
                  <div className="text-caption text-muted mt-8">
                    {a.service_key}
                    {a.task_id ? ` · ${a.task_id}` : ""} · {fmtRelative(a.triggered_at)}
                  </div>
                </div>
                <Badge status={a.status} />
              </div>
              <p className="text-muted text-sm mt-12">{a.message}</p>
              {a.status === "firing" ? (
                <div className="row mt-16 gap-12">
                  <button className="btn btn-primary" onClick={() => act(a.id, "resolve")} type="button">
                    恢复
                  </button>
                  <button className="btn btn-ghost" onClick={() => act(a.id, "mute")} type="button">
                    静默
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {alerts.length ? null : <EmptyState title="暂无告警" description="当前筛选条件下没有告警记录" />}
          {data ? <Pagination page={data.page} pageSize={data.page_size} total={data.total} onChange={setPage} /> : null}
        </div>}
      </PageStack>
    </Shell>
  );
}
