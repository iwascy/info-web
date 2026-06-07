export const STATUS_LABEL: Record<string, string> = {
  healthy: "正常",
  running: "运行中",
  warning: "警告",
  error: "异常",
  unknown: "未知",
  paused: "暂停",
  firing: "触发中",
  resolved: "已恢复",
  muted: "已静默",
  success: "成功",
  ok: "正常"
};

export const TYPE_LABEL: Record<string, string> = {
  sync: "同步",
  api: "API",
  crawler: "爬虫",
  script: "脚本",
  agent: "Agent",
  worker: "Worker"
};

export function statusTone(s?: string | null) {
  return ({ healthy: "healthy", running: "running", warning: "warning", error: "error", unknown: "unknown", paused: "paused", success: "healthy", ok: "healthy", firing: "error", resolved: "healthy", muted: "paused" } as Record<string, string>)[s || ""] || "unknown";
}

export function toneColor(tone: string) {
  return ({ blue: "#3785ff", cyan: "#17d5eb", green: "#29d684", yellow: "#f8b831", red: "#ff5b6f", purple: "#975cff", healthy: "#29d684", running: "#3785ff", warning: "#f8b831", error: "#ff5b6f", unknown: "#94a6c3", paused: "#975cff" } as Record<string, string>)[tone] || "#3785ff";
}

export function fmtNumber(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US");
}

export function fmtCompact(n?: number | null) {
  if (n === null || n === undefined) return "—";
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return n.toLocaleString("en-US");
}

export function fmtBytes(b?: number | null) {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${u[i]}`;
}

export function fmtRelative(iso?: string | null) {
  if (!iso) return "从未";
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 0) return "刚刚";
  if (diff < 60) return `${diff} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

export function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("zh-CN", { hour12: false });
}
