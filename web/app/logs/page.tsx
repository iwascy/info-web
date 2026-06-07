"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Download, Search } from "lucide-react";
import { Shell } from "@/components/Shell";
import { JsonBlock } from "@/components/UI";
import { fetcher } from "@/lib/api";
import { fmtRelative, fmtTime } from "@/lib/format";
import type { EventRecord } from "@/lib/types";

export default function LogsPage() {
  const { data } = useSWR<EventRecord[]>("/api/events?limit=200", fetcher, { refreshInterval: 10000 });
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const events = useMemo(() => (data || []).filter((e) => (type === "all" || e.type === type) && `${e.service_key} ${e.message || ""} ${JSON.stringify(e.raw_payload)}`.toLowerCase().includes(q.toLowerCase())), [data, type, q]);
  function exportJson() {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "opspilot-events.json";
    a.click();
  }
  return (
    <Shell title="日志" subtitle="心跳、进度、错误、系统事件的统一时间线。">
      <div className="toolbar-row"><div className="chips">{["all", "heartbeat", "progress", "error", "system"].map((f) => <button key={f} className={`chip ${type === f ? "active" : ""}`} onClick={() => setType(f)}>{f}</button>)}</div><div className="row"><div className="search"><Search size={17} /><input placeholder="搜索事件 / JSON" value={q} onChange={(e) => setQ(e.target.value)} /></div><button className="btn btn-ghost" onClick={exportJson}><Download size={16} />导出</button></div></div>
      <div className="card card-pad"><div className="timeline">{events.map((e) => <div key={e.id} className={`tl-item ${e.level === "error" ? "error" : e.level === "success" ? "success" : "running"}`}><span className="tl-dot" /><div className="tl-head"><span className="tl-msg">{e.message || e.type}</span><span className="tl-time">{fmtTime(e.created_at)}</span></div><div className="tl-meta">{e.service_key} · {e.type} · {fmtRelative(e.created_at)}</div><div className="mt-12"><JsonBlock value={e.raw_payload} /></div></div>)}</div></div>
    </Shell>
  );
}
