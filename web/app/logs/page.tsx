"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Download, Search } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Chip, EmptyState, JsonBlock, PageLoading, PageStack, Toolbar } from "@/components/UI";
import { fetcher } from "@/lib/api";
import { filterLabel, fmtRelative, fmtTime } from "@/lib/format";
import type { EventRecord } from "@/lib/types";

const filters = ["all", "heartbeat", "progress", "error", "system"];

export default function LogsPage() {
  const { data, isLoading } = useSWR<EventRecord[]>("/api/events?limit=200", fetcher);
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const events = useMemo(
    () =>
      (data || []).filter(
        (e) =>
          (type === "all" || e.type === type) &&
          `${e.service_key} ${e.message || ""} ${JSON.stringify(e.raw_payload)}`.toLowerCase().includes(q.toLowerCase())
      ),
    [data, type, q]
  );

  function exportJson() {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "opspilot-events.json";
    a.click();
  }

  if (isLoading) {
    return (
      <Shell title="日志" subtitle="正在读取最近事件">
        <PageLoading label="正在加载日志" />
      </Shell>
    );
  }

  return (
    <Shell title="日志" subtitle="心跳、进度、错误、系统事件的统一时间线。">
      <PageStack>
        <Toolbar
          left={filters.map((f) => (
            <Chip key={f} active={type === f} onClick={() => setType(f)}>
              {filterLabel(f)}
            </Chip>
          ))}
          right={
            <>
              <div className="search">
                <Search size={16} />
                <input placeholder="搜索事件 / JSON" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <button className="btn btn-ghost" onClick={exportJson} type="button">
                <Download size={16} />
                导出
              </button>
            </>
          }
        />

        <div className="card card-pad">
          {events.length ? (
            <div className="timeline">
              {events.map((e) => (
                <div key={e.id} className={`tl-item ${e.level === "error" ? "error" : e.level === "success" ? "success" : "running"}`}>
                  <span className="tl-dot" />
                  <div className="tl-head">
                    <span className="tl-msg">{e.message || e.type}</span>
                    <span className="tl-time">{fmtTime(e.created_at)}</span>
                  </div>
                  <div className="tl-meta">
                    {e.service_key} · {filterLabel(e.type)} · {fmtRelative(e.created_at)}
                  </div>
                  <div className="mt-12">
                    <JsonBlock value={e.raw_payload} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="暂无事件" description="调整筛选条件或等待服务上报" />
          )}
        </div>
      </PageStack>
    </Shell>
  );
}
