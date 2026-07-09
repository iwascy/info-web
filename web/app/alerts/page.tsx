"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Shell } from "@/components/Shell";
import { Badge, Chip, EmptyState, MetricCard, PageStack, Toolbar } from "@/components/UI";
import { apiPost, fetcher } from "@/lib/api";
import { filterLabel, fmtRelative } from "@/lib/format";
import type { Alert } from "@/lib/types";

const filters = ["all", "firing", "resolved", "muted", "high", "medium", "low"];

export default function AlertsPage() {
  const { data, mutate } = useSWR<Alert[]>("/api/alerts?status=all", fetcher, { refreshInterval: 10000 });
  const [filter, setFilter] = useState("all");
  const alerts = useMemo(
    () => (data || []).filter((a) => filter === "all" || a.status === filter || a.severity === filter),
    [data, filter]
  );

  async function act(id: number, action: "resolve" | "mute") {
    await apiPost(`/api/alerts/${id}/${action}`);
    mutate();
  }

  async function resolveAll() {
    if (!confirm("恢复所有触发中的告警？")) return;
    await apiPost("/api/alerts/resolve-all");
    mutate();
  }

  return (
    <Shell title="告警" subtitle="按严重度排序，触发中的告警优先处理。">
      <PageStack>
        <div className="grid grid-4">
          <MetricCard label="触发中" value={data?.filter((a) => a.status === "firing").length || 0} tone="red" icon="alert" />
          <MetricCard label="高严重度" value={data?.filter((a) => a.severity === "high").length || 0} tone="yellow" icon="alert" />
          <MetricCard label="已恢复" value={data?.filter((a) => a.status === "resolved").length || 0} tone="green" icon="checkCircle" />
          <MetricCard label="已静默" value={data?.filter((a) => a.status === "muted").length || 0} tone="purple" icon="shield" />
        </div>

        <Toolbar
          left={filters.map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
              {filterLabel(f)}
            </Chip>
          ))}
          right={
            <button className="btn btn-ghost" onClick={resolveAll} type="button">
              全部恢复
            </button>
          }
        />

        <div className="section-stack">
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
        </div>
      </PageStack>
    </Shell>
  );
}
