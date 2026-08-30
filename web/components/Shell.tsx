"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowLeftRight, Code2, Home, List, LogOut, RefreshCw, Server, Settings, ShipWheel } from "lucide-react";
import useSWR from "swr";
import { useRefreshNow, useRefreshSettings } from "@/components/AppProviders";
import { clearAuthToken, fetcher, getStoredToken } from "@/lib/api";
import { PIKPAK_MIGRATION_HREF } from "@/lib/routes";
import type { CountResponse } from "@/lib/types";

const navSections = [
  {
    label: "监控",
    items: [
      { key: "dashboard", label: "总览", icon: Home, href: "/dashboard" },
      { key: "services", label: "服务", icon: Server, href: "/services" },
      { key: "alerts", label: "告警", icon: AlertTriangle, href: "/alerts", badge: true },
      { key: "logs", label: "日志", icon: List, href: "/logs" }
    ]
  },
  {
    label: "任务",
    items: [
      { key: "sync", label: "同步任务", icon: ShipWheel, href: "/sync" },
      { key: "pikpak-115", label: "PikPak → 115", icon: ArrowLeftRight, href: PIKPAK_MIGRATION_HREF }
    ]
  },
  {
    label: "系统",
    items: [
      { key: "settings", label: "设置", icon: Settings, href: "/settings" },
      { key: "api-docs", label: "API 文档", icon: Code2, href: "/api-docs" }
    ]
  }
];

export function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const refresh = useRefreshSettings();
  const refreshNow = useRefreshNow();

  useEffect(() => {
    if (!getStoredToken()) {
      window.location.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setReady(true);
  }, [pathname]);

  const { data, error } = useSWR<CountResponse>(ready ? "/api/alerts/count?status=firing" : null, fetcher);

  useEffect(() => {
    if (error?.name === "AuthError") {
      window.location.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [error, pathname]);

  const firing = data?.count || 0;

  if (!ready) {
    return (
      <>
        <div className="bg-decor" />
        <div className="auth-loading">正在校验访问权限...</div>
      </>
    );
  }

  return (
    <>
      <div className="bg-decor" />
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">
              <Activity size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="brand-name">OpsPilot</div>
              <div className="brand-sub">个人服务面板</div>
            </div>
          </div>

          <div className="nav-groups">
            {navSections.map((section) => (
              <div className="nav-group" key={section.label}>
                <div className="nav-section">{section.label}</div>
                <nav className="nav" aria-label={section.label}>
                  {section.items.map((n) => {
                    const Icon = n.icon;
                    const active = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
                    return (
                      <Link key={n.key} className={`nav-item ${active ? "active" : ""}`} href={n.href} aria-label={n.label} title={n.label}>
                        <Icon size={18} strokeWidth={2.2} />
                        <span>{n.label}</span>
                        {n.badge && firing ? <span className="nav-badge">{firing}</span> : null}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="sidebar-foot sidebar-logout"
            onClick={() => {
              clearAuthToken();
              window.location.href = "/login";
            }}
          >
            <div className="avatar">
              <LogOut size={16} />
            </div>
            <div>
              <div className="foot-name">退出登录</div>
              <div className="foot-sub">清除本机访问令牌</div>
            </div>
          </button>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="topbar-titles">
              <h1>{title}</h1>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            <div className="topbar-spacer" />
            <div className="topbar-tools">
              <div className="refresh-group">
                <label htmlFor="auto-refresh">自动刷新</label>
                <label className="switch" aria-label="自动刷新">
                  <input id="auto-refresh" type="checkbox" checked={refresh.enabled} onChange={(event) => refresh.setEnabled(event.target.checked)} />
                  <span className="track" />
                  <span className="thumb" />
                </label>
              </div>
              <select
                className="select"
                value={String(refresh.intervalSeconds)}
                onChange={(event) => refresh.setIntervalSeconds(Number(event.target.value))}
                aria-label="刷新间隔"
                disabled={!refresh.enabled}
              >
                <option value="10">10 秒</option>
                <option value="30">30 秒</option>
                <option value="60">60 秒</option>
                <option value="300">5 分钟</option>
              </select>
              <button className="btn btn-ghost btn-icon" onClick={() => void refreshNow()} title="立即刷新" aria-label="立即刷新" type="button">
                <RefreshCw size={16} />
              </button>
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
  return (
    <div className="clock" suppressHydrationWarning>
      {now ? `${now.toLocaleDateString("zh-CN")} ${now.toLocaleTimeString("zh-CN", { hour12: false })}` : "—"}
    </div>
  );
}
