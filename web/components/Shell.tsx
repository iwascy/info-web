"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Bell, Code2, Home, List, LogOut, RefreshCw, Server, Settings, ShipWheel } from "lucide-react";
import useSWR from "swr";
import { clearAuthToken, fetcher, getStoredToken } from "@/lib/api";
import type { Alert } from "@/lib/types";

const nav = [
  { key: "dashboard", label: "总览", icon: Home, href: "/dashboard" },
  { key: "services", label: "服务", icon: Server, href: "/services" },
  { key: "sync", label: "同步任务", icon: ShipWheel, href: "/sync" },
  { key: "alerts", label: "告警", icon: AlertTriangle, href: "/alerts", badge: true },
  { key: "logs", label: "日志", icon: List, href: "/logs" },
  { key: "settings", label: "设置", icon: Settings, href: "/settings" },
  { key: "api-docs", label: "API 文档", icon: Code2, href: "/api-docs" }
];

export function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!getStoredToken()) {
      window.location.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setReady(true);
  }, [pathname]);
  const { data, error } = useSWR<Alert[]>(ready ? "/api/alerts?status=firing" : null, fetcher, { refreshInterval: 30000 });
  useEffect(() => {
    if (error?.name === "AuthError") {
      window.location.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [error, pathname]);
  const firing = data?.length || 0;
  if (!ready) {
    return <><div className="bg-decor" /><div className="auth-loading">正在校验访问权限...</div></>;
  }
  return (
    <>
      <div className="bg-decor" />
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark"><Bell size={24} /></div>
            <div><div className="brand-name">OpsPilot</div><div className="brand-sub">个人服务面板</div></div>
          </div>
          <div className="nav-section">监控</div>
          <nav className="nav">
            {nav.map((n) => {
              const Icon = n.icon;
              const active = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
              return (
                <Link key={n.key} className={`nav-item ${active ? "active" : ""}`} href={n.href}>
                  <Icon size={19} /><span>{n.label}</span>{n.badge && firing ? <span className="nav-badge">{firing}</span> : null}
                </Link>
              );
            })}
          </nav>
          <button className="sidebar-foot sidebar-logout" onClick={() => { clearAuthToken(); window.location.href = "/login"; }}>
            <div className="avatar"><LogOut size={17} /></div><div><div className="foot-name">退出登录</div><div className="foot-sub">清除本机访问令牌</div></div>
          </button>
        </aside>
        <div className="main">
          <header className="topbar">
            <div className="topbar-titles"><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
            <div className="topbar-spacer" />
            <div className="topbar-tools">
              <div className="refresh-group"><label>自动刷新</label><label className="switch"><input type="checkbox" defaultChecked /><span className="track" /><span className="thumb" /></label></div>
              <select className="select" defaultValue="30"><option value="10">10 秒</option><option value="30">30 秒</option><option value="60">60 秒</option><option value="300">5 分钟</option></select>
              <button className="btn btn-ghost btn-icon" onClick={() => location.reload()} title="立即刷新"><RefreshCw size={17} /></button>
              <Clock />
            </div>
          </header>
          <main className="content">{children}</main>
        </div>
      </div>
    </>
  );
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <div className="clock" suppressHydrationWarning>{now ? `${now.toLocaleDateString("zh-CN")} ${now.toLocaleTimeString("zh-CN", { hour12: false })}` : "—"}</div>;
}
