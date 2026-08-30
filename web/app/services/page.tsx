"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Grid2X2, List, Search, Trash2 } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Badge, Chip, EmptyState, MetricCard, PageLoading, PageStack, Progress, ServiceCell, Toolbar, TypeTag } from "@/components/UI";
import { apiDelete, fetcher } from "@/lib/api";
import { filterLabel, fmtRelative, statusTone } from "@/lib/format";
import { serviceHref } from "@/lib/routes";
import type { Service } from "@/lib/types";

const filters = ["all", "error", "warning", "running", "healthy", "unknown", "paused"];

export default function ServicesPage() {
  const { data, isLoading, mutate } = useSWR<Service[]>("/api/services", fetcher);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [grid, setGrid] = useState(false);
  const services = useMemo(
    () =>
      (data || []).filter(
        (s) => (filter === "all" || s.status === filter) && `${s.name} ${s.service_key}`.toLowerCase().includes(q.toLowerCase())
      ),
    [data, filter, q]
  );
  const counts = Object.fromEntries(filters.map((f) => [f, f === "all" ? data?.length || 0 : data?.filter((s) => s.status === f).length || 0]));

  async function remove(key: string) {
    if (confirm(`删除服务 ${key}？相关前端列表会立即移除。`)) {
      await apiDelete(`/api/services/${key}`);
      mutate();
    }
  }

  if (isLoading) {
    return (
      <Shell title="服务" subtitle="正在读取被监控服务">
        <PageLoading label="正在加载服务" />
      </Shell>
    );
  }

  return (
    <Shell title="服务" subtitle="查看所有被监控服务，异常状态会自动置顶。">
      <PageStack>
        <div className="grid grid-4">
          <MetricCard label="异常" value={counts.error} tone="red" icon="alert" />
          <MetricCard label="运行中" value={counts.running} tone="blue" icon="activity" />
          <MetricCard label="正常" value={counts.healthy} tone="green" icon="checkCircle" />
          <MetricCard label="未知" value={counts.unknown} tone="purple" icon="server" />
        </div>

        <Toolbar
          left={filters.map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)} count={counts[f]}>
              {filterLabel(f)}
            </Chip>
          ))}
          right={
            <>
              <div className="search">
                <Search size={16} />
                <input placeholder="搜索服务名 / key" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setGrid(!grid)} title="切换视图" type="button">
                {grid ? <List size={16} /> : <Grid2X2 size={16} />}
              </button>
            </>
          }
        />

        {grid ? (
          <div className="view-grid">
            {services.map((s) => (
              <div key={s.service_key} className={`card card-pad hoverable ${s.status === "error" ? "card-error" : ""}`}>
                <div className="row">
                  <ServiceCell href={serviceHref(s.service_key)} name={s.name} sub={s.service_key} type={s.type} />
                  <span className="spacer" />
                  <Badge status={s.status} />
                </div>
                <hr className="divider" />
                <div className="stat-grid">
                  <div className="stat-box">
                    <div className="k">类型</div>
                    <div className="v v-sm">
                      <TypeTag type={s.type} />
                    </div>
                  </div>
                  <div className="stat-box">
                    <div className="k">最近心跳</div>
                    <div className="v v-sm">{fmtRelative(s.last_heartbeat_at)}</div>
                  </div>
                </div>
                {s.progress != null ? (
                  <div className="mt-16">
                    <div className="progress-row">
                      <Progress value={s.progress} tone={statusTone(s.status)} />
                      <span className="pct">{s.progress}%</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            {services.length ? null : <EmptyState title="无匹配服务" description="试试调整筛选或搜索关键词" />}
          </div>
        ) : (
          <div className="card card-pad">
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>服务</th>
                    <th>类型</th>
                    <th>状态</th>
                    <th>消息</th>
                    <th className="num">进度</th>
                    <th>最近心跳</th>
                    <th className="actions" />
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.service_key} className={s.status === "error" ? "row-error" : ""}>
                      <td>
                        <ServiceCell href={serviceHref(s.service_key)} name={s.name} sub={s.service_key} type={s.type} />
                      </td>
                      <td>
                        <TypeTag type={s.type} />
                      </td>
                      <td>
                        <Badge status={s.status} />
                      </td>
                      <td className="text-muted truncate-cell" title={s.message || undefined}>
                        {s.message || "—"}
                      </td>
                      <td className="num">
                        {s.progress != null ? (
                          <div className="progress-row">
                            <Progress value={s.progress} tone={statusTone(s.status)} />
                            <span className="pct">{s.progress}%</span>
                          </div>
                        ) : (
                          <span className="text-dim">—</span>
                        )}
                      </td>
                      <td className="text-muted nowrap">{fmtRelative(s.last_heartbeat_at)}</td>
                      <td className="actions">
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => remove(s.service_key)} title="删除" type="button">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {services.length ? null : <EmptyState title="无匹配服务" description="试试调整筛选或搜索关键词" />}
            </div>
          </div>
        )}
      </PageStack>
    </Shell>
  );
}
