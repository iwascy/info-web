export type ServiceStatus = "healthy" | "running" | "warning" | "error" | "unknown" | "paused";
export type TaskStatus = "running" | "success" | "error" | "paused" | "warning";

export interface Service {
  id: number;
  service_key: string;
  name: string;
  type: "sync" | "api" | "crawler" | "script" | "agent" | "worker";
  status: ServiceStatus;
  message: string | null;
  last_heartbeat_at: string | null;
  last_progress_at: string | null;
  heartbeat_timeout_sec: number;
  created_at: string;
  progress?: number | null;
}

export interface SyncTask {
  id: number;
  service_key: string;
  task_id: string;
  name: string;
  status: TaskStatus;
  stage: string | null;
  total: number | null;
  processed: number | null;
  success: number | null;
  failed: number | null;
  skipped: number | null;
  progress: number | null;
  message: string | null;
  started_at: string | null;
  updated_at: string;
  total_bytes: number | null;
  done_bytes: number | null;
  instant_files: number | null;
  uploaded_files: number | null;
  queue_size: number | null;
  cursor: string | null;
  download_speed: number | null;
  upload_speed: number | null;
  current_file: string | null;
  current_stage: string | null;
  window_start: string | null;
  window_end: string | null;
  window_enabled: boolean | null;
  download_series?: number[];
  upload_series?: number[];
  stages?: Stage[];
  batches?: BatchRecord[];
  error_samples?: ErrorSample[];
  recent_files?: RecentFile[];
  accounts?: AccountHealth[];
}

export interface Stage { key: string; name: string; status: string; progress?: number; meta?: string }
export interface BatchRecord { id: number; task_id: string; range: string; total: number; success: number; failed: number; duration: string; created_at: string }
export interface ErrorSample { id: number; task_id: string; file: string; code: string; reason: string; level: string; payload: unknown; created_at: string }
export interface RecentFile { id: number; task_id: string; name: string; size: number; path: string; status: string; download_speed: number | null; upload_speed: number | null; duration: string | null; created_at: string }
export interface AccountHealth { id: number; task_id: string; side: "source" | "target"; label: string; account: string; used_bytes: number; total_bytes: number; unit: string; note: string | null; ok: boolean }

export interface Alert {
  id: number;
  service_key: string;
  task_id: string | null;
  severity: "high" | "medium" | "low";
  title: string;
  message: string;
  status: "firing" | "resolved" | "muted";
  triggered_at: string;
  resolved_at: string | null;
}

export interface EventRecord {
  id: number;
  service_key: string;
  task_id: string | null;
  type: "heartbeat" | "progress" | "error" | "system";
  level: string;
  message: string | null;
  stage: string | null;
  percentage: number | null;
  current: number | null;
  total: number | null;
  file_name: string | null;
  status: string | null;
  download_speed: number | null;
  upload_speed: number | null;
  raw_payload: unknown;
  created_at: string;
}

export interface Dashboard {
  total_services: number;
  healthy: number;
  running: number;
  warning: number;
  error: number;
  unknown: number;
  paused: number;
  today_alerts: number;
  today_completed_tasks: number;
  total_synced_bytes: number;
  uptime_pct: number;
  avg_progress_pct: number;
  services: Service[];
  sync_tasks: SyncTask[];
  alerts: Alert[];
  sys: Record<string, { value: number; series: number[] } | undefined>;
}
