"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Ban, Check, ClipboardCopy, KeyRound, RotateCcw } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Badge, PageStack } from "@/components/UI";
import { API_BASE, apiDelete, apiPost, fetcher } from "@/lib/api";
import { fmtRelative } from "@/lib/format";
import type { IngestIntegration } from "@/lib/types";

const SAMPLE_SNAPSHOT = `{
  "schema_version": 1,
  "sequence": 28,
  "observed_at": "2026-08-30T14:20:00+08:00",
  "service": { "key": "my-project", "name": "我的项目" },
  "task": { "id": "job-20260830-001", "name": "每日传输", "status": "running" },
  "categories": [
    {
      "key": "a",
      "name": "A 类",
      "order": 1,
      "download": {
        "status": "running",
        "total_bytes": 10737418240,
        "done_bytes": 4509715660,
        "speed_bps": 12582912,
        "current_item": "example.zip"
      },
      "upload": {
        "status": "running",
        "total_items": 100,
        "done_items": 31,
        "speed_bps": 8388608
      }
    }
  ]
}`;

export default function ApiDocsPage() {
  const { data: settings } = useSWR<Record<string, string>>("/api/settings", fetcher);
  const { data: integrations, mutate: mutateIntegrations } = useSWR<IngestIntegration[]>("/api/integrations", fetcher);
  const [form, setForm] = useState({ service_key: "", name: "" });
  const [issued, setIssued] = useState<IngestIntegration | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const prompt = useMemo(
    () => buildTransferAiPrompt(API_BASE, issued?.token || "<点击生成后自动填入>", form.service_key || "your-service-key", form.name || "服务展示名"),
    [form.name, form.service_key, issued?.token]
  );

  function updateForm(key: "service_key" | "name", value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setIssued(null);
    setCopied(false);
  }

  async function generateAndCopy() {
    const serviceKey = form.service_key.trim();
    if (!serviceKey) {
      setError("请先填写 service_key");
      return;
    }
    setError("");
    try {
      let integration = issued;
      if (!integration) {
        integration = await apiPost<IngestIntegration>("/api/integrations", { service_key: serviceKey, name: form.name.trim() || serviceKey });
        setIssued(integration);
        await mutateIntegrations();
      }
      await navigator.clipboard.writeText(buildTransferAiPrompt(API_BASE, integration.token || "", serviceKey, form.name.trim() || serviceKey));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成接入提示词失败");
    }
  }

  async function rotateToken() {
    if (!issued?.service_key) return;
    try {
      const integration = await apiPost<IngestIntegration>(`/api/integrations/${encodeURIComponent(issued.service_key)}/rotate`);
      setIssued(integration);
      setCopied(false);
      await mutateIntegrations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "轮换 Token 失败");
    }
  }

  async function rotateExisting(item: IngestIntegration) {
    if (!window.confirm(`轮换 ${item.name} 的 Token？旧 Token 会立即失效。`)) return;
    try {
      const integration = await apiPost<IngestIntegration>(`/api/integrations/${encodeURIComponent(item.service_key)}/rotate`);
      setForm({ service_key: item.service_key, name: item.name });
      setIssued(integration);
      setCopied(false);
      setError("");
      await mutateIntegrations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "轮换 Token 失败");
    }
  }

  async function revoke(item: IngestIntegration) {
    if (!window.confirm(`吊销 ${item.name} 的 Token？该项目会停止上报。`)) return;
    try {
      await apiDelete(`/api/integrations/${encodeURIComponent(item.service_key)}`);
      if (issued?.service_key === item.service_key) setIssued(null);
      await mutateIntegrations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "吊销 Token 失败");
    }
  }

  const legacyToken = settings?.token || "<OPSPILOT_TOKEN>";

  return (
    <Shell title="接入中心" subtitle="生成项目级凭证，让代码助手一次完成多分类下载与上传进度接入。">
      <PageStack>
        <div className="cols-12">
          <div className="span-5 card card-pad">
            <div className="card-head">
              <h3>项目身份</h3>
              <span className="sub">分类由目标项目自动发现</span>
            </div>
            <div className="field">
              <label htmlFor="integration-key">service_key</label>
              <input id="integration-key" className="input" placeholder="my-transfer-service" value={form.service_key} onChange={(event) => updateForm("service_key", event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="integration-name">展示名称</label>
              <input id="integration-name" className="input" placeholder="我的传输服务" value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={generateAndCopy} type="button">
              {copied ? <Check size={16} /> : <ClipboardCopy size={16} />}
              {copied ? "已复制" : issued ? "复制给 AI" : "生成并复制给 AI"}
            </button>
            {issued ? (
              <div className="integration-issued mt-16">
                <div className="row gap-12">
                  <KeyRound size={16} />
                  <span className="mono">{issued.token_prefix}...</span>
                  <span className="spacer" />
                  <Badge status="healthy" label="已就绪" />
                </div>
                <button className="btn btn-ghost btn-sm mt-12" onClick={rotateToken} type="button"><RotateCcw size={14} />轮换 Token</button>
              </div>
            ) : null}
            {error ? <div className="modal-warn mt-16">{error}</div> : null}
          </div>

          <div className="span-7 card card-pad">
            <div className="card-head">
              <h3>AI 接入提示词</h3>
              <span className="sub">Token 只在生成或轮换时返回</span>
            </div>
            <pre className="codeblock json-pre integration-prompt">{prompt}</pre>
          </div>
        </div>

        <div className="card card-pad">
          <div className="card-head">
            <h3>已接入项目</h3>
            <span className="sub">独立 Token · 可单独轮换</span>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>项目</th><th>Token</th><th>状态</th><th>最近上报</th><th>创建时间</th><th aria-label="操作" /></tr></thead>
              <tbody>
                {(integrations || []).map((item) => (
                  <tr key={item.service_key}>
                    <td><div className="cell-title">{item.name}</div><div className="cell-key">{item.service_key}</div></td>
                    <td className="mono">{item.token_prefix}...</td>
                    <td><Badge status={item.revoked_at ? "paused" : item.last_used_at ? "healthy" : "unknown"} label={item.revoked_at ? "已吊销" : item.last_used_at ? "已连接" : "等待首次上报"} /></td>
                    <td className="text-muted">{fmtRelative(item.last_used_at)}</td>
                    <td className="text-muted">{fmtRelative(item.created_at)}</td>
                    <td>
                      <div className="row gap-8 nowrap">
                        <button className="btn btn-ghost btn-icon" title="轮换 Token" aria-label={`轮换 ${item.name} Token`} onClick={() => rotateExisting(item)} type="button"><RotateCcw size={15} /></button>
                        {!item.revoked_at ? <button className="btn btn-danger btn-icon" title="吊销 Token" aria-label={`吊销 ${item.name} Token`} onClick={() => revoke(item)} type="button"><Ban size={15} /></button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!integrations?.length ? <div className="empty"><p>还没有项目级接入</p></div> : null}
          </div>
        </div>

        <div className="cols-12">
          <div className="span-7 card card-pad">
            <div className="card-head"><h3>通用传输快照</h3><span className="sub">POST /api/transfer-progress</span></div>
            <pre className="codeblock json-pre">{SAMPLE_SNAPSHOT}</pre>
          </div>
          <div className="span-5 card card-pad">
            <div className="card-head"><h3>兼容接口</h3><span className="sub">旧项目无需立即迁移</span></div>
            <pre className="codeblock json-pre">{`POST ${API_BASE}/api/progress
Authorization: Bearer ${legacyToken}

POST ${API_BASE}/api/heartbeat
Authorization: Bearer ${legacyToken}

新项目优先使用 /api/transfer-progress。
旧 /api/progress 会继续维护原有单进度任务。`}</pre>
          </div>
        </div>
      </PageStack>
    </Shell>
  );
}

function buildTransferAiPrompt(apiBase: string, token: string, serviceKey: string, serviceName: string) {
  return `请为当前项目接入 OpsPilot 通用多分类传输进度。先阅读并理解现有任务调度、分类定义、下载回调、上传回调、重试和退出流程，再做最小范围修改；不要开发任何新的信息展示页面。

连接信息：
- Base URL: ${apiBase}
- Endpoint: POST ${apiBase}/api/transfer-progress
- Heartbeat: POST ${apiBase}/api/heartbeat
- Authorization: Bearer ${token}
- Content-Type: application/json
- service_key: ${serviceKey}
- service_name: ${serviceName}

实现目标：
1. 自动识别项目已有的业务分类，不要假定只有 A/B/C/D，也不要在 OpsPilot 中维护分类枚举。
2. 每个分类分别采集 download 和 upload；某方向不存在时省略该对象。
3. reporter 必须是独立模块，配置来自环境变量；Token 禁止写入源码、版本库或日志。
4. 上报异步、非阻塞、超时 3-5 秒；失败只写脱敏日志，不得影响原任务。
5. 同一轮任务使用稳定 task.id；断点续传沿用它。sequence 从 1 单调递增，防止并发上报乱序回退。
6. 每次发送所有分类的完整快照。开始、分类变化、结束、失败立即发送；运行中最多每 5 秒一次或进度变化至少 1%。
7. 服务启动立即 heartbeat，之后每 30 秒一次。

快照结构：
${SAMPLE_SNAPSHOT.replace('"my-project"', JSON.stringify(serviceKey)).replace('"我的项目"', JSON.stringify(serviceName))}

字段规则：
- task.status: running | success | error | paused | warning | retry_waiting
- 方向 status: pending | running | success | error | paused | skipped | unknown | retry_waiting
- total_bytes/done_bytes、total_items/done_items、speed_bps 都是非负 JSON 数字；速度单位 bytes/s。
- 百分比由 OpsPilot 优先按字节、其次按项目数计算。两种总量都拿不到时才传 progress: 0-100。
- current_item 只能包含安全文件名，不能包含 Token、Cookie、签名 URL 或敏感绝对路径。
- 成功或失败必须发送最终完整快照；成功状态下对应方向计数应到达最终值，速度归零。

验收要求：
- 为 reporter 和映射逻辑增加测试，覆盖多分类、只有单方向、总量未知、乱序 sequence、成功、失败、超时和上报失败不影响业务。
- 运行项目现有测试。
- 输出修改文件、环境变量、分类来源、task.id 生成策略及一条不含真实 Token 的验证命令。
- OpsPilot 页面应自动出现该项目和所有分类；不要为这个项目创建专属前端页面。`;
}
