"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, LockKeyhole, LogIn, RadioTower, ShieldCheck } from "lucide-react";
import { getStoredToken, login } from "@/lib/api";

export default function LoginPage() {
  return (
    <Suspense fallback={<><div className="bg-decor" /><div className="auth-loading">正在加载登录页...</div></>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      await login(username.trim(), password);
      window.location.replace(next);
    } catch {
      setError("账号或密码无效，请使用服务端登录配置文件中的凭据。");
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
              <h2>账号登录</h2>
              <p>Server config</p>
            </div>
          </div>
          <label className="field">
            <span>账号</span>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" placeholder="opspilot" />
          </label>
          <label className="field">
            <span>密码</span>
            <input className="input mono" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="请输入密码" />
          </label>
          {error ? <div className="modal-warn">{error}</div> : null}
          <button className="btn btn-primary login-submit" disabled={loading || !username.trim() || !password}>
            {loading ? <span className="spin"><LogIn size={16} /></span> : <LogIn size={16} />}
            {loading ? "正在登录" : "进入面板"}
          </button>
          <div className="login-note">
            <ShieldCheck size={16} />
            <span>登录成功后会在当前浏览器保存访问令牌，用于调用受保护接口。</span>
          </div>
        </form>
      </main>
    </>
  );
}
