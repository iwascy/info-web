"use client";

import { useState } from "react";
import useSWR from "swr";
import { Copy, RotateCcw } from "lucide-react";
import { Shell } from "@/components/Shell";
import { apiPost, apiPut, fetcher } from "@/lib/api";

export default function SettingsPage() {
  const { data, mutate } = useSWR<Record<string, string>>("/api/settings", fetcher);
  const [form, setForm] = useState({ service_key: "", name: "", type: "sync" });
  const [message, setMessage] = useState("");
  async function createService() {
    await apiPost("/api/services", form);
    setForm({ service_key: "", name: "", type: "sync" });
    setMessage("服务已新增");
  }
  async function resetToken() {
    await apiPost("/api/token/reset");
    mutate();
  }
  async function updateSetting(key: string, value: boolean) {
    await apiPut("/api/settings", { [key]: String(value) });
    mutate();
  }
  const token = data?.token || "";
  const autoRefresh = data?.auto_refresh !== "false";
  const alertSound = data?.alert_sound === "true";
  return (
    <Shell title="设置" subtitle="接入令牌、服务向导、刷新偏好与危险操作。">
      <div className="cols-12">
        <div className="span-6 card card-pad"><div className="card-head"><h3>新增服务向导</h3></div><div className="field"><label>service_key</label><input className="input" value={form.service_key} onChange={(e) => setForm({ ...form, service_key: e.target.value })} placeholder="pikpak-115-sg2" /></div><div className="field"><label>名称</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="PikPak → 115 网盘迁移" /></div><div className="field"><label>类型</label><select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="sync">同步</option><option value="api">API</option><option value="crawler">爬虫</option><option value="script">脚本</option><option value="agent">Agent</option><option value="worker">Worker</option></select></div><button className="btn btn-primary" onClick={createService}>新增服务</button>{message ? <div className="mt-12 t-green">{message}</div> : null}</div>
        <div className="span-6 card card-pad"><div className="card-head"><h3>接入令牌</h3><span className="sub">Authorization: Bearer</span></div><div className="codeblock">{token || "加载中..."}</div><div className="row mt-16"><button className="btn btn-ghost" disabled={!token} onClick={() => navigator.clipboard.writeText(token)}><Copy size={16} />复制</button><button className="btn btn-danger" onClick={resetToken}><RotateCcw size={16} />重置</button></div><hr className="divider" /><div className="field"><label className="row">自动刷新 <span className="spacer" /><span className="switch"><input type="checkbox" checked={autoRefresh} onChange={(e) => updateSetting("auto_refresh", e.target.checked)} /><span className="track" /><span className="thumb" /></span></label></div><div className="field"><label className="row">告警声音 <span className="spacer" /><span className="switch"><input type="checkbox" checked={alertSound} onChange={(e) => updateSetting("alert_sound", e.target.checked)} /><span className="track" /><span className="thumb" /></span></label></div><div className="modal-warn">危险操作：删除服务会移除面板中的服务记录，真实被监控服务不会被停止。</div></div>
      </div>
    </Shell>
  );
}
