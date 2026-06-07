"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, LockKeyhole, LogIn, RadioTower, ShieldCheck } from "lucide-react";
import { getStoredToken, login } from "@/lib/api";

export default function LoginPage() {
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getStoredToken()) {
      window.location.replace(next);
    }
  }, [next]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(token.trim());
      window.location.replace(next);
    } catch {
      setError("令牌无效，请使用后端当前 OPSPILOT_TOKEN 或设置页重置后的令牌。");
      setLoading(false);
    }
  }

  return (
    <>
      <div className="bg-decor" />
      <main className="login-page">
        <section className="login-hero">
          <div className="brand login-brand">
            <div className="brand-mark"><Bell size={24} /></div>
            <div><div className="brand-name">OpsPilot</div><div className="brand-sub">个人服务面板</div></div>
          </div>
          <div className="login-copy">
            <div className="login-kicker"><RadioTower size={15} />实时服务状态</div>
            <h1>登录控制台</h1>
            <p>使用当前接入令牌进入面板，查看真实上报的服务、任务、告警和事件。</p>
          </div>
          <div className="login-signal">
            <span />
            <i />
          </div>
        </section>

        <form className="card card-pad login-card" onSubmit={submit}>
          <div className="login-card-head">
            <span className="cell-ico ic-blue"><LockKeyhole size={19} /></span>
            <div>
              <h2>访问令牌</h2>
              <p>Authorization: Bearer</p>
            </div>
          </div>
          <label className="field">
            <span>Token</span>
            <input className="input mono" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoFocus autoComplete="current-password" placeholder="op_..." />
          </label>
          {error ? <div className="modal-warn">{error}</div> : null}
          <button className="btn btn-primary login-submit" disabled={loading || !token.trim()}>
            {loading ? <span className="spin"><LogIn size={16} /></span> : <LogIn size={16} />}
            {loading ? "正在登录" : "进入面板"}
          </button>
          <div className="login-note">
            <ShieldCheck size={16} />
            <span>令牌只保存在当前浏览器本地，用于调用受保护的写入与设置接口。</span>
          </div>
        </form>
      </main>
    </>
  );
}
