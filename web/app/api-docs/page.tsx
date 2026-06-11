"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Check, ClipboardCopy } from "lucide-react";
import { Shell } from "@/components/Shell";
import { API_BASE, fetcher } from "@/lib/api";

export default function ApiDocsPage() {
  const { data } = useSWR<Record<string, string>>("/api/settings", fetcher);
  const [copied, setCopied] = useState(false);
  const token = data?.token || "<登录后从设置读取>";
  const heartbeat = `curl -X POST ${API_BASE}/api/heartbeat \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"service_key":"your-service-key","name":"服务展示名","type":"worker","status":"running","message":"running"}'`;
  const progress = `curl -X POST ${API_BASE}/api/progress \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"service_key":"your-service-key","task_id":"stable-task-id","name":"任务展示名","stage":"running","total":1000,"processed":420,"success":410,"failed":2,"progress":42.0}'`;
  const endpoints = ["POST /api/heartbeat", "POST /api/progress", "GET /api/dashboard", "GET /api/services", "POST /api/services", "GET /api/services/{key}", "DELETE /api/services/{key}", "GET /api/sync-tasks", "GET /api/sync-tasks/{id}", "POST /api/sync-tasks/{id}/pause", "POST /api/sync-tasks/{id}/resume", "GET /api/alerts", "POST /api/alerts/resolve-all", "POST /api/alerts/{id}/resolve", "POST /api/alerts/{id}/mute", "GET /api/events?type=&q=&limit=", "GET /api/settings", "PUT /api/settings", "POST /api/token/reset"];
  const aiPrompt = useMemo(() => buildAiPrompt(API_BASE, token), [token]);

  async function copyAiPrompt() {
    await navigator.clipboard.writeText(aiPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Shell title="API 文档" subtitle="被监控服务主动 PUSH 上报，前端查询 REST API。">
      <div className="card card-pad mb-20">
        <div className="card-head">
          <h3>发送给 AI 完成接入</h3>
          <span className="sub">复制后发给目标服务的代码助手，让它自动加上心跳与进度上报。</span>
          <span className="spacer" />
          <button className="btn btn-primary" onClick={copyAiPrompt}>
            {copied ? <Check size={16} /> : <ClipboardCopy size={16} />}
            {copied ? "已复制" : "复制给 AI"}
          </button>
        </div>
        <pre className="codeblock json-pre">{aiPrompt}</pre>
      </div>
      <div className="cols-12"><div className="span-6 card card-pad"><div className="card-head"><h3>心跳上报</h3></div><pre className="codeblock">{heartbeat}</pre></div><div className="span-6 card card-pad"><div className="card-head"><h3>进度上报</h3></div><pre className="codeblock">{progress}</pre></div></div>
      <div className="card card-pad mt-20"><div className="card-head"><h3>Endpoints</h3></div><div className="table-wrap"><table className="tbl"><thead><tr><th>接口</th><th>说明</th></tr></thead><tbody>{endpoints.map((e) => <tr key={e}><td className="mono">{e}</td><td className="text-muted">{e.startsWith("POST") || e.startsWith("PUT") || e.startsWith("DELETE") ? "写入 / 动作（需 Bearer）" : "查询（需 Bearer）"}</td></tr>)}</tbody></table></div></div>
    </Shell>
  );
}

function buildAiPrompt(apiBase: string, token: string) {
  return `请为当前服务接入 OpsPilot 主动上报。要求只做必要改动，保留现有业务逻辑。

OpsPilot API:
- Base URL: ${apiBase}
- Authorization: Bearer ${token}
- Content-Type: application/json

需要实现：
1. 服务启动后立即发送一次心跳，并在运行期间每 30 秒发送一次心跳。
2. 长任务、同步任务、迁移任务在进度变化时发送进度上报。
3. 捕获关键错误时，上报 status=error，并把错误原因写入 message。
4. 上报请求必须设置超时，不要阻塞主业务流程；失败可记录日志并继续业务。
5. service_key 使用稳定小写短横线命名；task_id 对同一个任务保持稳定。

心跳接口：
POST ${apiBase}/api/heartbeat
Headers:
  Authorization: Bearer ${token}
Body:
{
  "service_key": "your-service-key",
  "name": "服务展示名",
  "type": "sync|api|crawler|script|agent|worker",
  "status": "healthy|running|warning|error|unknown|paused",
  "message": "running"
}

进度接口：
POST ${apiBase}/api/progress
Headers:
  Authorization: Bearer ${token}
Body:
{
  "service_key": "your-service-key",
  "task_id": "stable-task-id",
  "name": "任务展示名",
  "status": "running|success|error|paused",
  "stage": "scan|download|upload|verify|cleaning|writing|...",
  "total": 1000,
  "processed": 420,
  "success": 410,
  "failed": 2,
  "skipped": 8,
  "progress": 42.0,
  "message": "正在处理",
  "file_name": "文件名已隐藏（可选）",
  "download_speed": 10485760,
  "upload_speed": 8388608
}

如果是文件迁移或类似任务，请额外上报这些字段：
{
  "total_bytes": 1000000000,
  "done_bytes": 420000000,
  "instant_files": 120,
  "uploaded_files": 300,
  "queue_size": 80,
  "cursor": "断点游标或 last message id",
  "current_file": "文件名已隐藏",
  "current_stage": "scan|download|upload|verify|done",
  "window_start": "02:00",
  "window_end": "08:00",
  "window_enabled": true
}

验收：
- 启动服务后，OpsPilot /services 能看到该服务。
- 运行任务时，OpsPilot /sync 能看到进度变化。
- 错误发生时，OpsPilot /alerts 能看到告警或服务异常。
- 所有上报都带 Bearer token，且不影响原服务主流程。`;
}
