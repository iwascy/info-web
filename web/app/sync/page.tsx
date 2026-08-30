"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Search } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Badge, Chip, EmptyState, MetricCard, PageLoading, PageStack, Pagination, Progress, Toolbar } from "@/components/UI";
import { fetcher } from "@/lib/api";
import { filterLabel, fmtCompact, fmtRelative } from "@/lib/format";
import { syncTaskHref } from "@/lib/routes";
import type { PageResponse, SyncTask } from "@/lib/types";

const filters = ["current", "error", "stale", "running", "success", "paused", "all"];
const PAGE_SIZE = 30;

export default function SyncPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("current");
  const [page, setPage] = useState(1);
  const query = useMemo(
    () => `/api/sync-tasks/page?filter=${encodeURIComponent(filter)}&q=${encodeURIComponent(q)}&page=${page}&page_size=${PAGE_SIZE}`,
    [filter, page, q]
  );
  const { data, isLoading } = useSWR<PageResponse<SyncTask>>(query, fetcher);
  const tasks = data?.items || [];
  const counts = data?.counts || {};
  const hero = tasks.find((t) => t.status === "running") || tasks[0];

  useEffect(() => setPage(1), [filter, q]);

  return (
    <Shell title="同步任务" subtitle="所有数据同步、迁移、批处理任务的实时进度。">
      <PageStack>
        <div className="grid grid-4">
          <MetricCard label="运行中" value={counts.running ?? "—"} tone="blue" icon="activity" />
          <MetricCard label="异常 / 失联" value={(counts.error || 0) + (counts.stale || 0)} tone="red" icon="alert" />
          <MetricCard label="已完成" value={counts.success ?? "—"} tone="green" icon="checkCircle" />
          <MetricCard
            label="当前范围"
            value={counts.current ?? "—"}
            note="运行、异常与近 7 天完成"
            tone="purple"
            icon="layers"
          />
        </div>

        {hero ? (
          <Link href={syncTaskHref(hero.task_id)} className={`card card-pad hoverable route-card ${hero.status === "error" || hero.status === "stale" ? "card-error" : ""}`}>
            <div className="detail-header">
              <div className="min-w-0">
                <div className="text-caption text-muted">当前任务</div>
                <h2 className="hero-title mt-8">{hero.name}</h2>
                <div className="cell-key mt-8">
                  {hero.service_key} · {hero.task_id}
                </div>
              </div>
              <span className="spacer" />
              <Badge status={hero.status} />
            </div>
            <div className="progress-row mt-20">
              <Progress value={hero.progress} large tone={hero.status === "error" ? "red" : "blue"} />
              <span className="pct t-blue">{Math.round(hero.progress || 0)}%</span>
            </div>
            <div className="stat-grid mt-16">
              <div className="stat-box">
                <div className="k">阶段</div>
                <div className="v v-sm">{hero.stage || "—"}</div>
              </div>
              <div className="stat-box">
                <div className="k">处理</div>
                <div className="v v-sm">
                  {fmtCompact(hero.processed)} / {fmtCompact(hero.total)}
                </div>
              </div>
              <div className="stat-box">
                <div className="k">最近更新</div>
                <div className="v v-sm">{fmtRelative(hero.updated_at)}</div>
              </div>
            </div>
          </Link>
        ) : null}

        <Toolbar
          left={filters.map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)} count={counts[f]}>
              {filterLabel(f)}
            </Chip>
          ))}
          right={
            <div className="search">
              <Search size={16} />
              <input placeholder="搜索任务" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          }
        />

        {isLoading && !data ? <PageLoading label="正在加载同步任务" /> : <div className="card card-pad">
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>任务</th>
                  <th>服务</th>
                  <th>状态</th>
                  <th>阶段</th>
                  <th className="num">进度</th>
                  <th className="num">成功 / 失败</th>
                  <th>更新时间</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.task_id} className={t.status === "error" || t.status === "stale" ? "row-error" : ""}>
                    <td>
                      <Link href={syncTaskHref(t.task_id)} className="route-card">
                        <div className="cell-title">{t.name}</div>
                        <div className="cell-key">{t.task_id}</div>
                      </Link>
                    </td>
                    <td className="cell-key">{t.service_key}</td>
                    <td>
                      <Badge status={t.status} />
                    </td>
                    <td>{t.stage || "—"}</td>
                    <td className="num">
                      <div className="progress-row">
                        <Progress value={t.progress} tone={t.status === "error" ? "red" : "blue"} />
                        <span className="pct">{Math.round(t.progress || 0)}%</span>
                      </div>
                    </td>
                    <td className="num mono">
                      {fmtCompact(t.success)} / <span className="t-red">{fmtCompact(t.failed)}</span>
                    </td>
                    <td className="text-muted nowrap">{fmtRelative(t.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tasks.length ? null : <EmptyState title="暂无同步任务" description="当前筛选条件下没有任务" />}
          </div>
          {data ? <Pagination page={data.page} pageSize={data.page_size} total={data.total} onChange={setPage} /> : null}
        </div>}
      </PageStack>
    </Shell>
  );
}
